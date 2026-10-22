"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { AccountError, createAccount, updateAccount, resetAccountPassword } from "@/lib/accounts";
import type { AccountRole } from "@/lib/account-types";

export type AccountActionState = { status: "idle" | "success" | "error"; message?: string };

function scalar(form: FormData, name: string): string | null {
  const values = form.getAll(name);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
}

function roleValue(value: string | null): AccountRole | null {
  return value === "admin" || value === "editor" ? value : null;
}

function error(message: string): AccountActionState {
  return { status: "error", message };
}

export async function createAccountAction(_previous: AccountActionState, form: FormData): Promise<AccountActionState> {
  const session = await assertAdmin();
  const username = scalar(form, "username")?.trim();
  const displayName = scalar(form, "displayName")?.trim();
  const role = roleValue(scalar(form, "role"));
  const password = scalar(form, "password");
  if (!username || !/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username)) return error("用户名需为 3–32 位小写字母、数字、下划线或短横线，并以字母或数字开头");
  if (!displayName || displayName.length > 60) return error("显示名称需为 1–60 个字符");
  if (!role) return error("请选择有效的角色");
  if (!password || password.length < 12 || password.length > 128) return error("密码需为 12–128 个字符");
  try {
    await createAccount(session.accountId, { username, displayName, role, password });
  } catch (cause) {
    if (cause instanceof AccountError) return error(cause.message);
    throw cause;
  }
  revalidatePath("/admin/accounts");
  return { status: "success", message: `账号 ${username} 已创建` };
}

export async function updateAccountAction(_previous: AccountActionState, form: FormData): Promise<AccountActionState> {
  const session = await assertAdmin();
  const id = scalar(form, "accountId");
  const displayName = scalar(form, "displayName")?.trim();
  const role = roleValue(scalar(form, "role"));
  const enabled = scalar(form, "enabled");
  if (!id) return error("账号参数不正确，请刷新后重试");
  if (!displayName || displayName.length > 60) return error("显示名称需为 1–60 个字符");
  if (!role) return error("请选择有效的角色");
  if (enabled !== "true" && enabled !== "false") return error("请选择有效的账号状态");
  try {
    await updateAccount(session.accountId, id, { displayName, role, enabled: enabled === "true" });
  } catch (cause) {
    if (cause instanceof AccountError) return error(cause.message);
    throw cause;
  }
  revalidatePath("/admin", "layout");
  return { status: "success", message: "账号资料已保存" };
}

export async function resetAccountPasswordAction(_previous: AccountActionState, form: FormData): Promise<AccountActionState> {
  const session = await assertAdmin();
  const id = scalar(form, "accountId");
  const password = scalar(form, "password");
  if (!id) return error("账号参数不正确，请刷新后重试");
  if (id === session.accountId) return error("请前往「我的账号」修改自己的密码");
  if (!password || password.length < 12 || password.length > 128) return error("密码需为 12–128 个字符");
  try {
    await resetAccountPassword(session.accountId, id, password);
  } catch (cause) {
    if (cause instanceof AccountError) return error(cause.message);
    throw cause;
  }
  revalidatePath("/admin/accounts");
  return { status: "success", message: "密码已重置，该账号的所有设备已退出登录" };
}
