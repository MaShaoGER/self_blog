import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PublicAccount } from "./account-types";
import { clientIp, describeDevice, maskIp } from "./request";
import {
  clearSessionToken, getSessionsForAccount, issueSession, readSession,
  revokeAccountSession, revokeOtherAccountSessions, type AccountSession,
} from "./sessions";

export const SESSION_COOKIE = "blog_session";

export async function createSession(account: PublicAccount): Promise<void> {
  const h = await headers();
  const { token } = await issueSession(account, {
    device: describeDevice(h.get("user-agent")), ip: maskIp(await clientIp()),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 30 * 24 * 60 * 60,
  });
}

export async function getSession(): Promise<AccountSession | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<AccountSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<AccountSession> {
  const session = await requireSession();
  if (session.account.role !== "admin") redirect("/admin?denied=1");
  return session;
}

export async function assertSession(): Promise<AccountSession> {
  const session = await getSession();
  if (!session) throw new Response("未登录", { status: 401 });
  return session;
}

export async function assertAdmin(): Promise<AccountSession> {
  const session = await assertSession();
  if (session.account.role !== "admin") throw new Response("需要管理员权限", { status: 403 });
  return session;
}

export async function listSessions(accountId: string) {
  return getSessionsForAccount(accountId);
}

export async function revokeSession(id: string, accountId: string): Promise<void> {
  await revokeAccountSession(accountId, id);
}

export async function revokeOtherSessions(keepId: string, accountId: string): Promise<void> {
  await revokeOtherAccountSessions(accountId, keepId);
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  await clearSessionToken(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}
