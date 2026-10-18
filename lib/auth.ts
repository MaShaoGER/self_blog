import path from "node:path";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hmac, randomToken, safeEqual } from "./crypto";
import { DATA_DIR, adminPassword, sessionSecret } from "./env";
import { clientIp, describeDevice, maskIp } from "./request";
import { readJson, updateJson } from "./store";
import type { Session } from "./types";

export const SESSION_COOKIE = "blog_session";
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Avoid rewriting sessions.json on every request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

type SessionsFile = { sessions: Session[] };
const EMPTY: SessionsFile = { sessions: [] };

function sign(id: string): string {
  return `${id}.${hmac(sessionSecret(), `session:${id}`)}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  return safeEqual(token, sign(id)) ? id : null;
}

export function checkPassword(input: string): boolean {
  return safeEqual(input, adminPassword());
}

function alive(s: Session, now = Date.now()) {
  return new Date(s.expiresAt).getTime() > now;
}

export async function createSession(): Promise<void> {
  const h = await headers();
  const now = new Date();
  const session: Session = {
    id: randomToken(24),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
    device: describeDevice(h.get("user-agent")),
    ip: maskIp(await clientIp()),
  };
  await updateJson(SESSIONS_FILE, EMPTY, (f) => ({
    value: { sessions: [...f.sessions.filter((s) => alive(s)), session] },
    result: undefined,
  }));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sign(session.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

/** Returns the current session if the cookie is valid and the session hasn't been revoked. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const id = verify(jar.get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const { sessions } = await readJson(SESSIONS_FILE, EMPTY);
  const s = sessions.find((x) => x.id === id);
  if (!s || !alive(s)) return null;
  if (Date.now() - new Date(s.lastSeenAt).getTime() > TOUCH_INTERVAL_MS) {
    const nowIso = new Date().toISOString();
    // Sliding expiry: active devices stay signed in.
    void updateJson(SESSIONS_FILE, EMPTY, (f) => ({
      value: {
        sessions: f.sessions.map((x) =>
          x.id === id ? { ...x, lastSeenAt: nowIso, expiresAt: new Date(Date.now() + TTL_MS).toISOString() } : x,
        ),
      },
      result: undefined,
    })).catch(() => undefined);
  }
  return s;
}

/** Use at the top of every admin page/layout. */
export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Use in Server Actions and route handlers; throws instead of redirecting. */
export async function assertAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Response("未登录", { status: 401 });
  return s;
}

export async function listSessions(): Promise<Session[]> {
  const { sessions } = await readJson(SESSIONS_FILE, EMPTY);
  return sessions.filter((s) => alive(s)).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export async function revokeSession(id: string): Promise<void> {
  await updateJson(SESSIONS_FILE, EMPTY, (f) => ({
    value: { sessions: f.sessions.filter((s) => s.id !== id) },
    result: undefined,
  }));
}

export async function revokeOtherSessions(keepId: string): Promise<void> {
  await updateJson(SESSIONS_FILE, EMPTY, (f) => ({
    value: { sessions: f.sessions.filter((s) => s.id === keepId) },
    result: undefined,
  }));
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const id = verify(jar.get(SESSION_COOKIE)?.value);
  if (id) await revokeSession(id);
  jar.delete(SESSION_COOKIE);
}
