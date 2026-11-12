import { promises as fs } from "node:fs";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { ResourcesDataError, canAccessStoredVideo } from "@/lib/resources";
import { resolveUpload } from "@/lib/uploads";
import { serveVideoRequest } from "@/lib/videos";
import { storedVideoFile } from "@/shared/video-links";

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

/** Images keep their long-lived cache; uploaded videos follow catalogue permissions. */
async function serveImage(parts: string[], head: boolean): Promise<Response> {
  const full = resolveUpload(parts.join("/"));
  const type = full ? TYPES[path.extname(full).toLowerCase()] : undefined;
  if (!full || !type) return notFound();
  try {
    const stats = await fs.stat(full);
    if (!stats.isFile()) return notFound();
    const headers = {
      "Content-Type": type,
      // Filenames are random and never reused, so they can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(stats.size),
    };
    if (head) return new Response(null, { status: 200, headers });
    const data = await fs.readFile(full);
    return new Response(new Uint8Array(data), { headers });
  } catch {
    return notFound();
  }
}

/**
 * Uploaded videos are only readable while a resource record still grants access:
 * anonymous visitors need a visible public record, staff may read any record.
 */
async function serveVideo(req: Request, parts: string[], head: boolean): Promise<Response> {
  if (parts.length !== 2) return notFound();
  const identifier = `${parts[0]}/${parts[1]}`;
  const stored = storedVideoFile(`/uploads/${identifier}`);
  if (!stored) return notFound();
  try {
    const session = await getSession();
    const allowed = await canAccessStoredVideo(`/uploads/${identifier}`, session !== null);
    if (!allowed) return notFound();
  } catch (error) {
    if (error instanceof ResourcesDataError) {
      return new Response("资源数据无法读取", { status: 500, headers: { "Cache-Control": "private, no-store" } });
    }
    throw error;
  }
  return serveVideoRequest(req, parts, head);
}

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }, head: boolean): Promise<Response> {
  const { path: parts } = await ctx.params;
  if (parts[0] === "videos") return serveVideo(req, parts, head);
  return serveImage(parts, head);
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx, false);
}

export async function HEAD(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx, true);
}
