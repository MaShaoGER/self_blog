import { promises as fs } from "node:fs";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { randomToken } from "./crypto";
import { UPLOADS_DIR } from "./env";
import { atomicWrite } from "./store";
import type { UploadItem } from "./types";

// SVG is not an accepted upload format; reject it before native metadata parsing.
sharp.block({ operation: ["VipsForeignLoadSvg"] });

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 2400;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);

export class UploadError extends Error {}

/** Resolve a user-supplied relative path, refusing anything that escapes the uploads dir. */
export function resolveUpload(rel: string): string | null {
  const full = path.resolve(UPLOADS_DIR, rel);
  return full.startsWith(UPLOADS_DIR + path.sep) ? full : null;
}

function urlFor(rel: string): string {
  return `/uploads/${rel.split(path.sep).join("/")}`;
}

/**
 * Decode with sharp (which also validates it is a real image), auto-rotate,
 * strip metadata incl. GPS, downscale, and re-encode as WebP.
 * Animated GIFs keep their frames.
 */
export async function saveUpload(buf: Buffer): Promise<UploadItem> {
  if (buf.length === 0) throw new UploadError("文件是空的");
  if (buf.length > MAX_UPLOAD_BYTES) throw new UploadError("图片不能超过 15 MB");

  let meta: Metadata;
  try {
    meta = await sharp(buf, { animated: true }).metadata();
  } catch {
    throw new UploadError("无法识别这张图片，请上传 JPG、PNG、WebP、GIF 或 AVIF");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new UploadError("不支持这种图片格式");
  }

  const animated = (meta.pages ?? 1) > 1;
  const { data, info } = await sharp(buf, { animated, limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const now = new Date();
  const dir = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
  const rel = path.join(dir, `${randomToken(9)}.webp`);
  await atomicWrite(path.join(UPLOADS_DIR, rel), data);

  return {
    path: rel.split(path.sep).join("/"),
    url: urlFor(rel),
    size: data.length,
    width: info.width,
    height: animated ? info.pageHeight ?? info.height : info.height,
    createdAt: now.toISOString(),
  };
}

export async function listUploads(): Promise<UploadItem[]> {
  const items: UploadItem[] = [];
  async function walk(dir: string) {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (/\.(webp|png|jpe?g|gif|avif)$/i.test(e.name)) {
        const st = await fs.stat(full);
        const rel = path.relative(UPLOADS_DIR, full);
        items.push({ path: rel.split(path.sep).join("/"), url: urlFor(rel), size: st.size, createdAt: st.mtime.toISOString() });
      }
    }
  }
  await walk(UPLOADS_DIR);
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteUpload(rel: string): Promise<void> {
  const full = resolveUpload(rel);
  if (!full) throw new UploadError("非法路径");
  await fs.rm(full, { force: true });
}
