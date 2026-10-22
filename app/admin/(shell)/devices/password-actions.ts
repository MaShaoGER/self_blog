"use server";

import { redirect } from "next/navigation";
import { assertSession, destroyCurrentSession } from "@/lib/auth";
import { AccountError, changeOwnPassword } from "@/lib/accounts";

export type ChangePasswordState = { status: "idle" | "error"; message?: string };

function scalar(form: FormData, name: string): string | null {
  const values = form.getAll(name);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
}

export async function changeOwnPasswordAction(_previous: ChangePasswordState, form: FormData): Promise<ChangePasswordState> {
  const session = await assertSession();
  const currentPassword = scalar(form, "currentPassword");
  const newPassword = scalar(form, "newPassword");
  const confirmation = scalar(form, "confirmation");
  if (!currentPassword) return { status: "error", message: "请输入当前密码" };
  if (!newPassword || newPassword.length < 12 || newPassword.length > 128) return { status: "error", message: "新密码需为 12–128 个字符" };
  if (confirmation !== newPassword) return { status: "error", message: "两次输入的新密码不一致" };
  try {
    await changeOwnPassword(session.accountId, currentPassword, newPassword);
  } catch (cause) {
    if (cause instanceof AccountError) return { status: "error", message: cause.message };
    throw cause;
  }
  await destroyCurrentSession();
  redirect("/login?changed=1");
}
