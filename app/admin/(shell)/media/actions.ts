"use server";

import { revalidatePath } from "next/cache";
import { assertSession } from "@/lib/auth";
import { deleteUpload } from "@/lib/uploads";

export async function deleteUploadAction(path: string): Promise<void> {
  await assertSession();
  if (typeof path !== "string" || !path) throw new Error("参数不正确");
  // deleteUpload 内部会拒绝越出 uploads 目录的路径
  await deleteUpload(path);
  revalidatePath("/admin/media");
}
