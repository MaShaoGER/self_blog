import { randomUUID } from "node:crypto";
import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { UPLOADS_DIR } from "./env";
import { MAX_VIDEO_BYTES } from "../shared/video-types";
import { storedVideoFile } from "../shared/video-links";

/** Upload failures carry the HTTP status the route handler should return. */
export class VideoUploadError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "VideoUploadError";
    this.status = status;
  }
}

type StoredFormat = "mp4" | "webm";

const MIME_BY_FORMAT: Record<StoredFormat, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
};

/** Header bytes inspected before anything is flushed to disk. */
const HEADER_LIMIT = 4096;
const VIDEOS_DIR = path.join(UPLOADS_DIR, "videos");
const RANGE_HEADER = /^bytes=(\d*)-(\d*)$/;

function storedFormat(mimeType: string, name: string): StoredFormat {
  const mime = (mimeType.split(";")[0] ?? "").trim().toLowerCase();
  if (mime !== "video/mp4" && mime !== "video/webm") {
    throw new VideoUploadError("只支持 MP4 或 WebM 视频", 415);
  }
  const ext = path.extname(path.basename(name.trim())).slice(1).toLowerCase();
  if (ext !== "mp4" && ext !== "webm") {
    throw new VideoUploadError("文件名需以 .mp4 或 .webm 结尾", 415);
  }
  if (`video/${ext}` !== mime) {
    throw new VideoUploadError("文件扩展名与视频类型不一致", 415);
  }
  return ext;
}

function isPrintableBrand(value: string): boolean {
  return /^[\x20-\x7e]{4}$/.test(value) && value.trim() !== "";
}

/** Container verdict: valid, cut short, or a different format. */
type Sniff = "ok" | "truncated" | "mismatch";

/** MP4 keeps its brands inside the leading ftyp box; QuickTime/MOV shares the box but the qt brand. */
function mp4Sniff(buffer: Buffer): Sniff {
  if (buffer.length < 8) return "truncated";
  if (buffer.toString("latin1", 4, 8) !== "ftyp") return "mismatch";
  const boxSize = buffer.readUInt32BE(0);
  const brandOffset = boxSize === 1 ? 16 : 8;
  if (buffer.length < brandOffset + 8) return "truncated";
  const declared = boxSize === 1 ? buffer.readBigUInt64BE(8) : BigInt(boxSize);
  if (declared !== 0n && declared < BigInt(brandOffset + 8)) return "mismatch";
  const majorBrand = buffer.toString("latin1", brandOffset, brandOffset + 4);
  if (!isPrintableBrand(majorBrand) || majorBrand === "qt  ") return "mismatch";
  const limit = declared === 0n || declared > BigInt(buffer.length) ? buffer.length : Number(declared);
  for (let offset = brandOffset + 8; offset + 4 <= limit; offset += 4) {
    if (buffer.toString("latin1", offset, offset + 4) === "qt  ") return "mismatch";
  }
  return "ok";
}

function ebmlIdentifier(buffer: Buffer, offset: number): { id: number; next: number } | null {
  const first = buffer[offset];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (length <= 4 && (first & (0x80 >> (length - 1))) === 0) length += 1;
  if (length > 4) return null;
  let id = 0;
  for (let index = 0; index < length; index += 1) {
    const byte = buffer[offset + index];
    if (byte === undefined) return null;
    id = id * 256 + byte;
  }
  return { id, next: offset + length };
}

function ebmlSize(buffer: Buffer, offset: number): { size: number; unknown: boolean; next: number } | null {
  const first = buffer[offset];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length += 1;
  if (length > 8) return null;
  let value = first & (0xff >> length);
  let allOnes = value === (0xff >> length);
  for (let index = 1; index < length; index += 1) {
    const byte = buffer[offset + index];
    if (byte === undefined) return null;
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  return { size: value, unknown: allOnes, next: offset + length };
}

/** WebM is EBML whose DocType element reads exactly "webm"; Matroska must not pass. */
function webmSniff(buffer: Buffer): Sniff {
  if (buffer.length < 4) return "truncated";
  if (buffer[0] !== 0x1a || buffer[1] !== 0x45 || buffer[2] !== 0xdf || buffer[3] !== 0xa3) return "mismatch";
  if (buffer.length < 5) return "truncated";
  const header = ebmlSize(buffer, 4);
  if (!header || header.unknown) return "mismatch";
  const end = header.next + header.size;
  if (end > buffer.length) return "truncated";
  let offset = header.next;
  while (offset < end) {
    const element = ebmlIdentifier(buffer, offset);
    if (!element) return "mismatch";
    const size = ebmlSize(buffer, element.next);
    if (!size || size.unknown) return "mismatch";
    const dataStart = size.next;
    const dataEnd = dataStart + size.size;
    if (dataEnd > end) return "mismatch";
    if (element.id === 0x4282) {
      return buffer.toString("latin1", dataStart, dataEnd).replace(/\0+$/, "") === "webm" ? "ok" : "mismatch";
    }
    offset = dataEnd;
  }
  return "mismatch";
}

function sniff(header: Buffer, format: StoredFormat): Sniff {
  return format === "mp4" ? mp4Sniff(header) : webmSniff(header);
}

function formatRejection(result: Exclude<Sniff, "ok">): VideoUploadError {
  return result === "truncated"
    ? new VideoUploadError("视频文件不完整，请重新导出后上传", 400)
    : new VideoUploadError("文件内容与所选视频格式不一致", 415);
}

async function writeAll(handle: fs.FileHandle, data: Buffer): Promise<void> {
  let written = 0;
  while (written < data.length) {
    const { bytesWritten } = await handle.write(data, written, data.length - written);
    if (bytesWritten <= 0) throw new VideoUploadError("写入视频失败，请重试", 500);
    written += bytesWritten;
  }
}

/**
 * Stream a request body to an atomically published file. The first bounded chunk must prove
 * the real container matches the declared MIME type and extension, so a renamed or relabelled
 * file never becomes a servable video. Any failure removes exactly the files created here.
 */
export async function saveVideoStream(
  stream: ReadableStream<Uint8Array>,
  options: { name: string; mimeType: string; size?: number; signal?: AbortSignal },
): Promise<{ url: string; path: string; size: number; mimeType: string; format: StoredFormat }> {
  const format = storedFormat(options.mimeType, options.name);
  const mimeType = MIME_BY_FORMAT[format];
  if (options.size !== undefined && options.size > MAX_VIDEO_BYTES) {
    throw new VideoUploadError("视频不能超过 200 MB", 413);
  }

  await fs.mkdir(VIDEOS_DIR, { recursive: true, mode: 0o700 });
  const tempPath = path.join(VIDEOS_DIR, `.${randomUUID()}.${format}.part`);
  const handle = await fs.open(tempPath, "wx", 0o600);
  let published: string | null = null;
  let total = 0;
  const reader = stream.getReader();
  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const begin = async (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_VIDEO_BYTES) throw new VideoUploadError("视频不能超过 200 MB", 413);
      await writeAll(handle, chunk);
    };

    let pending: Buffer[] = [];
    let pendingSize = 0;
    let headerChecked = false;
    let declaredMp4Box = 0n;
    const checkHeader = (value: Buffer) => {
      const result = sniff(value, format);
      if (result !== "ok") throw formatRejection(result);
      if (format === "mp4") {
        const size = value.readUInt32BE(0);
        declaredMp4Box = size === 1 ? value.readBigUInt64BE(8) : BigInt(size);
      }
    };

    while (true) {
      if (options.signal?.aborted) throw new VideoUploadError("上传已中断，未保存视频", 400);
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      const chunk = Buffer.from(value.buffer, value.byteOffset, value.byteLength);

      if (!headerChecked) {
        const prefix = chunk.subarray(0, HEADER_LIMIT - pendingSize);
        pending.push(prefix);
        pendingSize += prefix.length;
        if (pendingSize < HEADER_LIMIT) continue;
        const header = Buffer.concat(pending, pendingSize);
        checkHeader(header);
        headerChecked = true;
        pending = [];
        pendingSize = 0;
        await begin(header);
        if (chunk.length > prefix.length) await begin(chunk.subarray(prefix.length));
        continue;
      }

      await begin(chunk);
    }

    if (!headerChecked) {
      const header = Buffer.concat(pending, pendingSize);
      pending = [];
      pendingSize = 0;
      if (header.length === 0) throw new VideoUploadError("没有收到视频内容", 400);
      checkHeader(header);
      headerChecked = true;
      await begin(header);
    }
    if (declaredMp4Box > BigInt(total)) {
      throw new VideoUploadError("视频文件不完整，请重新导出后上传", 400);
    }
    if (options.size !== undefined && total !== options.size) {
      throw new VideoUploadError("视频上传不完整，请重试", 400);
    }
    if (options.signal?.aborted) throw new VideoUploadError("上传已中断，未保存视频", 400);

    await handle.sync();
    await handle.close();

    let id = randomUUID();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = path.join(VIDEOS_DIR, `${id}.${format}`);
      try {
        await fs.link(tempPath, candidate);
        published = candidate;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        id = randomUUID();
      }
    }
    if (!published) throw new VideoUploadError("保存视频失败，请重试", 500);
    await fs.unlink(tempPath);

    return {
      url: `/uploads/videos/${path.basename(published)}`,
      path: published,
      size: total,
      mimeType,
      format,
    };
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    await handle.close().catch(() => undefined);
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    if (published) await fs.rm(published, { force: true }).catch(() => undefined);
    if (error instanceof VideoUploadError) throw error;
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new VideoUploadError("上传已中断，未保存视频", 400);
    }
    console.error("video save failed", error);
    throw new VideoUploadError("视频保存失败，请重试", 500);
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      // A read still settling after cancellation owns the lock; it releases it on completion.
    }
  }
}

/** Remove a file created by saveVideoStream. Only the exact /uploads/videos/UUID.ext path is accepted. */
export async function deleteStoredVideo(url: string): Promise<void> {
  const stored = typeof url === "string" ? storedVideoFile(url) : null;
  if (!stored) throw new VideoUploadError("视频路径无效", 400);
  await fs.rm(path.join(VIDEOS_DIR, stored.name), { force: true });
}

type RangeSpec = { kind: "partial"; start: number; end: number } | { kind: "invalid" };

function parseRange(header: string, size: number): RangeSpec {
  const match = RANGE_HEADER.exec(header.trim());
  if (!match) return { kind: "invalid" };
  const startText = match[1];
  const endText = match[2];
  if (startText === "" && endText === "") return { kind: "invalid" };
  if (size === 0) return { kind: "invalid" };
  if (startText === "") {
    if (!/^\d{1,20}$/.test(endText)) return { kind: "invalid" };
    const suffix = Number(endText);
    if (suffix === 0) return { kind: "invalid" };
    return { kind: "partial", start: Math.max(size - suffix, 0), end: size - 1 };
  }
  if (!/^\d{1,20}$/.test(startText)) return { kind: "invalid" };
  const start = Number(startText);
  if (!Number.isSafeInteger(start) || start >= size) return { kind: "invalid" };
  if (endText === "") return { kind: "partial", start, end: size - 1 };
  if (!/^\d{1,20}$/.test(endText)) return { kind: "invalid" };
  const end = Number(endText);
  if (!Number.isSafeInteger(end) || end < start) return { kind: "invalid" };
  return { kind: "partial", start, end: Math.min(end, size - 1) };
}

function videoHeaders(length: number, type: string): Headers {
  const headers = new Headers({
    "Content-Type": type,
    // Uploaded bytes follow catalogue permissions that can change at any time.
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": String(length),
  });
  return headers;
}

async function openStoredVideo(name: string): Promise<fs.FileHandle | null> {
  const stored = storedVideoFile(`/uploads/videos/${name}`);
  if (!stored || stored.name !== name) return null;
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(path.join(VIDEOS_DIR, name), fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch {
    return null;
  }
  const stats = await handle.stat();
  if (!stats.isFile()) {
    await handle.close();
    return null;
  }
  return handle;
}

/**
 * Serve a stored video from disk with byte-range support. Path validation happens here so the
 * helper stays pure filesystem; the route adds the catalogue permission gate around it.
 */
export async function serveVideoRequest(req: Request, parts: string[], head = false): Promise<Response> {
  if (parts.length !== 2 || parts[0] !== "videos") return new Response("Not found", { status: 404 });
  const handle = await openStoredVideo(parts[1]);
  if (!handle) return new Response("Not found", { status: 404 });

  let size: number;
  try {
    size = (await handle.stat()).size;
  } catch {
    await handle.close();
    return new Response("Not found", { status: 404 });
  }

  const name = parts[1];
  const type = name.endsWith(".webm") ? "video/webm" : "video/mp4";
  const rawRange = req.headers.get("range");

  if (head) {
    await handle.close();
    return new Response(null, { status: 200, headers: videoHeaders(size, type) });
  }

  if (rawRange !== null) {
    const range = parseRange(rawRange, size);
    if (range.kind === "invalid") {
      await handle.close();
      const headers = videoHeaders(0, type);
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    if (range.kind === "partial") {
      const length = range.end - range.start + 1;
      const headers = videoHeaders(length, type);
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
      const stream = handle.createReadStream({ start: range.start, end: range.end, autoClose: true });
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: 206, headers });
    }
  }

  if (size === 0) {
    await handle.close();
    return new Response(null, { status: 200, headers: videoHeaders(0, type) });
  }
  const stream = handle.createReadStream({ autoClose: true });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: videoHeaders(size, type),
  });
}
