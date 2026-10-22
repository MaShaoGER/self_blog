"use server";

import { revalidatePath } from "next/cache";
import { assertSession } from "@/lib/auth";
import { renameCommentSlug } from "@/lib/comments";
import { PostError, deletePost, savePost } from "@/lib/posts";
import type { PostInput } from "@/lib/types";

export type SaveResult = { ok: true; slug: string; savedAt: string } | { ok: false; error: string };

export async function savePostAction(input: PostInput, originalSlug: string | null): Promise<SaveResult> {
  await assertSession();
  try {
    const post = await savePost(input, originalSlug ?? undefined);
    if (originalSlug && originalSlug !== post.slug) await renameCommentSlug(originalSlug, post.slug);
    revalidatePath("/", "layout");
    return { ok: true, slug: post.slug, savedAt: new Date().toISOString() };
  } catch (err) {
    if (err instanceof PostError) return { ok: false, error: err.message };
    console.error("save post failed", err);
    return { ok: false, error: "保存失败，请稍后重试" };
  }
}

export async function deletePostAction(slug: string): Promise<void> {
  await assertSession();
  await deletePost(slug);
  revalidatePath("/", "layout");
}
