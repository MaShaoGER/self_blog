"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { deleteComment, setCommentStatus } from "@/lib/comments";
import type { CommentStatus } from "@/lib/types";

const STATUSES: CommentStatus[] = ["pending", "approved", "hidden"];

function revalidate() {
  // 角标在 shell layout、评论在前台文章页，统一刷新
  revalidatePath("/", "layout");
}

export async function setCommentStatusAction(id: string, status: CommentStatus): Promise<void> {
  await assertAdmin();
  if (typeof id !== "string" || !id || !STATUSES.includes(status)) throw new Error("参数不正确");
  await setCommentStatus(id, status);
  revalidate();
}

export async function deleteCommentAction(id: string): Promise<void> {
  await assertAdmin();
  if (typeof id !== "string" || !id) throw new Error("参数不正确");
  await deleteComment(id);
  revalidate();
}
