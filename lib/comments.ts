import path from "node:path";
import { randomId } from "./crypto";
import { DATA_DIR } from "./env";
import { readJson, updateJson } from "./store";
import type { Comment, CommentStatus, PublicComment } from "./types";

const FILE = path.join(DATA_DIR, "comments.json");
type CommentsFile = { comments: Comment[] };
const EMPTY: CommentsFile = { comments: [] };

export async function getAllComments(): Promise<Comment[]> {
  const { comments } = await readJson(FILE, EMPTY);
  return [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getApprovedComments(slug: string): Promise<PublicComment[]> {
  const { comments } = await readJson(FILE, EMPTY);
  return comments
    .filter((c) => c.postSlug === slug && c.status === "approved")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ id, author, website, body, createdAt }) => ({ id, author, website, body, createdAt }));
}

export async function countPending(): Promise<number> {
  const { comments } = await readJson(FILE, EMPTY);
  return comments.filter((c) => c.status === "pending").length;
}

export async function addComment(input: Omit<Comment, "id" | "createdAt">): Promise<Comment> {
  const comment: Comment = { ...input, id: randomId(), createdAt: new Date().toISOString() };
  return updateJson(FILE, EMPTY, (f) => ({ value: { comments: [...f.comments, comment] }, result: comment }));
}

export async function setCommentStatus(id: string, status: CommentStatus): Promise<void> {
  await updateJson(FILE, EMPTY, (f) => ({
    value: { comments: f.comments.map((c) => (c.id === id ? { ...c, status } : c)) },
    result: undefined,
  }));
}

export async function deleteComment(id: string): Promise<void> {
  await updateJson(FILE, EMPTY, (f) => ({ value: { comments: f.comments.filter((c) => c.id !== id) }, result: undefined }));
}

/** Keep comments attached when a post's slug changes. */
export async function renameCommentSlug(from: string, to: string): Promise<void> {
  if (from === to) return;
  await updateJson(FILE, EMPTY, (f) => ({
    value: { comments: f.comments.map((c) => (c.postSlug === from ? { ...c, postSlug: to } : c)) },
    result: undefined,
  }));
}
