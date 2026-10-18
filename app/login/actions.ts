"use server";

import { redirect } from "next/navigation";
import { checkPassword, createSession, destroyCurrentSession } from "@/lib/auth";
import { clientIp } from "@/lib/request";
import { hit, peek, reset } from "@/lib/rate-limit";

export type LoginState = { error?: string };

const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  // Only same-site relative paths; blocks //evil.com and /\evil.com
  return /^\/(?![/\\])/.test(s) ? s : "/admin";
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const key = `login:${await clientIp()}`;
  if (!peek(key, LIMIT)) {
    return { error: "尝试次数过多，请 15 分钟后再试" };
  }
  const password = String(form.get("password") ?? "");
  if (!password || !checkPassword(password)) {
    const { ok } = hit(key, LIMIT, WINDOW_MS);
    return { error: ok ? "密码不对" : "尝试次数过多，请 15 分钟后再试" };
  }
  reset(key);
  await createSession();
  redirect(safeNext(form.get("next")));
}

export async function logout(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}
