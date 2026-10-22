"use server";

import { redirect } from "next/navigation";
import { createSession, destroyCurrentSession } from "@/lib/auth";
import { attemptLogin } from "@/lib/login-attempt";
import { clientIp } from "@/lib/request";

export type LoginState = { error?: string };

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  // Only same-site relative paths; blocks //evil.com and /\evil.com
  return /^\/(?![/\\])/.test(s) ? s : "/admin";
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const result = await attemptLogin(await clientIp(), form.get("username"), form.get("password"));
  if (result.status !== "authenticated") {
    return { error: result.status === "limited"
      ? "尝试次数过多，请 15 分钟后再试"
      : "用户名或密码不正确，或账号已停用" };
  }
  await createSession(result.account);
  redirect(safeNext(form.get("next")));
}

export async function logout(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}
