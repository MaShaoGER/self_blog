import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { POSTS_DIR } from "./env";
import { excerptFrom, readingStats } from "./format";
import { atomicWrite, withLock } from "./store";
import type { Post, PostInput, PostMeta, PostStatus } from "./types";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

function fileFor(slug: string): string {
  if (!isValidSlug(slug)) throw new Error(`非法 slug：${slug}`);
  return path.join(POSTS_DIR, `${slug}.md`);
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && !Number.isNaN(new Date(v).getTime())) return new Date(v).toISOString();
  return new Date(0).toISOString();
}

function parse(slug: string, raw: string): Post {
  const { data, content } = matter(raw);
  // Legacy `draft: true` maps onto the newer status field.
  const status: PostStatus =
    data.status === "draft" || data.status === "published" || data.status === "scheduled"
      ? data.status
      : data.draft
        ? "draft"
        : "published";
  return {
    slug,
    title: String(data.title ?? slug),
    date: toIso(data.date),
    updated: data.updated ? toIso(data.updated) : undefined,
    excerpt: data.excerpt ? String(data.excerpt) : excerptFrom(content),
    cover: data.cover ? String(data.cover) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    status,
    featured: Boolean(data.featured),
    content,
    ...readingStats(content),
  };
}

/** Public visibility: published, or scheduled and its time has arrived. */
export function isLive(p: Pick<PostMeta, "status" | "date">, now = Date.now()): boolean {
  if (p.status === "published") return true;
  return p.status === "scheduled" && new Date(p.date).getTime() <= now;
}

async function readAll(): Promise<Post[]> {
  let files: string[];
  try {
    files = await fs.readdir(POSTS_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const posts = await Promise.all(
    files
      .filter((f) => f.endsWith(".md") && isValidSlug(f.slice(0, -3)))
      .map(async (f) => parse(f.slice(0, -3), await fs.readFile(path.join(POSTS_DIR, f), "utf8"))),
  );
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

function meta({ content: _c, ...m }: Post): PostMeta {
  return m;
}

/** Every post including drafts — admin only. */
export async function getAllPostsAdmin(): Promise<Post[]> {
  return readAll();
}

export async function getLivePosts(): Promise<PostMeta[]> {
  const now = Date.now();
  return (await readAll()).filter((p) => isLive(p, now)).map(meta);
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!isValidSlug(slug)) return null;
  try {
    return parse(slug, await fs.readFile(fileFor(slug), "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function getLivePost(slug: string): Promise<Post | null> {
  const p = await getPost(slug);
  return p && isLive(p) ? p : null;
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const counts = new Map<string, number>();
  for (const p of await getLivePosts()) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function searchPosts(q: string): Promise<(PostMeta & { snippet: string })[]> {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!terms.length) return [];
  const now = Date.now();
  const results: (PostMeta & { snippet: string; score: number })[] = [];
  for (const p of await readAll()) {
    if (!isLive(p, now)) continue;
    const title = p.title.toLowerCase();
    const body = p.content.toLowerCase();
    const tags = p.tags.join(" ").toLowerCase();
    if (!terms.every((t) => title.includes(t) || body.includes(t) || tags.includes(t))) continue;
    const score = terms.reduce((s, t) => s + (title.includes(t) ? 10 : 0) + (tags.includes(t) ? 4 : 0) + (body.includes(t) ? 1 : 0), 0);
    const idx = body.indexOf(terms[0]);
    const plain = excerptFrom(p.content.slice(Math.max(0, idx - 60), idx + 140), 140);
    results.push({ ...meta(p), snippet: idx >= 0 ? plain : (p.excerpt ?? ""), score });
  }
  return results.sort((a, b) => b.score - a.score).map(({ score: _s, ...r }) => r);
}

function serialise(input: PostInput, prev: Post | null): string {
  const fm: Record<string, unknown> = {
    title: input.title,
    date: input.date,
    status: input.status,
    tags: input.tags,
  };
  if (prev && prev.status !== "draft") fm.updated = new Date().toISOString();
  if (input.excerpt?.trim()) fm.excerpt = input.excerpt.trim();
  if (input.cover?.trim()) fm.cover = input.cover.trim();
  if (input.featured) fm.featured = true;
  return matter.stringify(input.content.endsWith("\n") ? input.content : `${input.content}\n`, fm);
}

export class PostError extends Error {}

/**
 * Create or update a post. `originalSlug` is the slug it was loaded under,
 * so renaming moves the file instead of leaving a stale copy behind.
 */
export async function savePost(input: PostInput, originalSlug?: string): Promise<Post> {
  const title = input.title.trim();
  if (!title) throw new PostError("标题不能为空");
  if (!isValidSlug(input.slug)) throw new PostError("链接名只能包含小写字母、数字和连字符");
  if (Number.isNaN(new Date(input.date).getTime())) throw new PostError("发布时间格式不正确");
  const clean: PostInput = {
    ...input,
    title,
    date: new Date(input.date).toISOString(),
    tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 12),
  };
  return withLock("posts", async () => {
    const prev = originalSlug ? await getPost(originalSlug) : null;
    if (clean.slug !== originalSlug && (await getPost(clean.slug))) {
      throw new PostError(`链接名「${clean.slug}」已被另一篇文章使用`);
    }
    await atomicWrite(fileFor(clean.slug), serialise(clean, prev));
    if (originalSlug && originalSlug !== clean.slug) await fs.rm(fileFor(originalSlug), { force: true });
    return (await getPost(clean.slug))!;
  });
}

export async function deletePost(slug: string): Promise<void> {
  await withLock("posts", () => fs.rm(fileFor(slug), { force: true }));
}
