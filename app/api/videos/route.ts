import { assertSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/request";
import { createResource, ResourceValidationError, ResourcesDataError } from "@/lib/resources";
import { VideoUploadError, deleteStoredVideo, saveVideoStream } from "@/lib/videos";
import { parseVideoLink, VideoLinkError } from "@/shared/video-links";
import { MAX_VIDEO_BYTES, type VideoInsertResult, type VideoLinkFormat } from "@/shared/video-types";
import path from "node:path";

const HEADERS = { "Cache-Control": "private, no-store" } as const;
const MAX_JSON_BYTES = 16 * 1024;
const JSON_KEYS = new Set(["url", "name", "format"]);
const VIDEO_MIMES: Record<string, true> = { "video/mp4": true, "video/webm": true };
const VIDEO_LINK_FORMATS: Record<VideoLinkFormat, true> = { mp4: true, webm: true, hls: true };

function isVideoLinkFormat(value: unknown): value is VideoLinkFormat {
  return typeof value === "string" && value in VIDEO_LINK_FORMATS;
}

export const maxDuration = 300;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: HEADERS });
}

function failure(error: unknown): Response {
  if (error instanceof VideoLinkError) return json({ error: error.message }, 400);
  if (error instanceof VideoUploadError) return json({ error: error.message }, error.status);
  if (error instanceof ResourceValidationError) return json({ error: error.message }, 400);
  if (error instanceof ResourcesDataError) return json({ error: "资源数据无法读取，请稍后重试" }, 500);
  console.error("video insert failed", error instanceof Error ? error.name : "unknown");
  return json({ error: "视频保存失败，请稍后重试" }, 500);
}

/** Read at most `limit` actual bytes; oversized bodies are rejected without buffering them all. */
async function readBoundedText(req: Request, limit: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength))).toString("utf8");
}

function displayName(raw: string, fallback: string): string {
  const base = path.basename(raw.trim()).replace(/\.(?:mp4|webm)$/i, "").trim();
  return (base || fallback).slice(0, 120);
}

async function insertFromJson(req: Request): Promise<Response> {
  const text = await readBoundedText(req, MAX_JSON_BYTES);
  if (text === null) return json({ error: "请求内容过大" }, 413);

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return json({ error: "请求内容无法解析" }, 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return json({ error: "请求内容格式不正确" }, 400);
  }
  for (const key of Object.keys(payload)) {
    if (!JSON_KEYS.has(key)) return json({ error: "请求包含无法识别的字段" }, 400);
  }
  const record: Record<string, unknown> = { ...payload };
  const rawUrl = record.url;
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return json({ error: "请粘贴视频链接" }, 400);
  if (record.name !== undefined && typeof record.name !== "string") return json({ error: "视频名称格式不正确" }, 400);
  const rawFormat = record.format;
  if (rawFormat !== undefined && !isVideoLinkFormat(rawFormat)) {
    return json({ error: "视频格式需为 mp4、webm 或 hls" }, 400);
  }
  const name = displayName(typeof record.name === "string" ? record.name : "", "视频");

  const source = parseVideoLink(rawUrl, rawFormat);
  const created = await createResource({
    name,
    description: "",
    kind: "video",
    parentId: null,
    visibility: "public",
    listed: false,
    source,
  });
  const result: VideoInsertResult = { id: created.id, name: created.name };
  return json(result, 201);
}

function declaredLength(req: Request): number | undefined {
  const raw = req.headers.get("content-length");
  if (raw === null) return undefined;
  if (!/^\d{1,18}$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : undefined;
}

function uploadName(value: string | null): string | null {
  if (!value) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.trim() || decoded.length > 260) return null;
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return null;
  return decoded;
}

async function insertFromFile(req: Request, mimeType: string): Promise<Response> {
  if (!req.body) return json({ error: "没有收到视频内容" }, 400);
  const filename = uploadName(req.headers.get("x-upload-name"));
  if (!filename) return json({ error: "缺少或无法读取上传文件名" }, 400);

  const length = declaredLength(req);
  if (length !== undefined && length > MAX_VIDEO_BYTES) return json({ error: "视频不能超过 200 MB" }, 413);

  const saved = await saveVideoStream(req.body, {
    name: filename,
    mimeType,
    ...(length !== undefined ? { size: length } : {}),
    signal: req.signal,
  });

  try {
    const created = await createResource({
      name: displayName(filename, "视频"),
      description: "",
      kind: "video",
      parentId: null,
      visibility: "public",
      listed: false,
      size: saved.size,
      source: { type: "direct", url: saved.url, format: saved.format },
    });
    const result: VideoInsertResult = { id: created.id, name: created.name, url: saved.url };
    return json(result, 201);
  } catch (error) {
    try {
      await deleteStoredVideo(saved.url);
    } catch {
      console.error("video cleanup failed after catalogue error");
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    await assertSameOrigin(req);
    await assertSession();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const mimeType = (req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  try {
    if (mimeType === "application/json") return await insertFromJson(req);
    if (mimeType in VIDEO_MIMES) return await insertFromFile(req, mimeType);
    return json({ error: "只支持 JSON 视频链接或 video/mp4、video/webm 请求体" }, 415);
  } catch (error) {
    return failure(error);
  }
}
