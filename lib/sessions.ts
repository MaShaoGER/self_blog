import path from "node:path";
import { getAccountById, getSessionAccount } from "./accounts";
import type { PublicAccount } from "./account-types";
import { hmac, randomToken, safeEqual } from "./crypto";
import { DATA_DIR, sessionSecret } from "./env";
import { readJson, updateJson } from "./store";
import type { Session } from "./types";

const FILE = path.join(DATA_DIR, "sessions.json");
const EMPTY = { sessions: [] as Session[] };
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type AccountSession = Session & {
  accountId: string;
  accountVersion: number;
  account: PublicAccount;
};

function alive(session: Session): boolean {
  return new Date(session.expiresAt).getTime() > Date.now();
}

function sign(id: string): string {
  return `${id}.${hmac(sessionSecret(), `session:${id}`)}`;
}

function verify(token: string | undefined): string | null {
  if (!token || !/^[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const id = token.slice(0, token.indexOf("."));
  return safeEqual(token, sign(id)) ? id : null;
}

export async function issueSession(account: PublicAccount, metadata: Pick<Session, "device" | "ip">) {
  const current = await getSessionAccount({ accountId: account.id, accountVersion: account.version });
  if (!current) throw new Error("账号已失效，请重新登录");
  const now = new Date();
  const session: Session = {
    id: randomToken(24),
    accountId: current.id,
    accountVersion: current.version,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
    device: metadata.device,
    ip: metadata.ip,
  };
  await updateJson(FILE, EMPTY, (value) => ({
    value: { sessions: [...value.sessions.filter(alive), session] }, result: undefined,
  }));
  return { session, token: sign(session.id) };
}

export async function readSession(token: string | undefined): Promise<AccountSession | null> {
  const id = verify(token);
  if (!id) return null;
  const { sessions } = await readJson(FILE, EMPTY);
  const session = sessions.find((item) => item.id === id);
  if (!session || !alive(session)) return null;
  const account = await getSessionAccount(session);
  if (!account) return null;
  if (Date.now() - new Date(session.lastSeenAt).getTime() > TOUCH_INTERVAL_MS) {
    const now = new Date();
    await updateJson(FILE, EMPTY, (value) => ({
      value: {
        sessions: value.sessions.map((item) => item.id === id && item.accountVersion === account.version
          ? { ...item, lastSeenAt: now.toISOString(), expiresAt: new Date(now.getTime() + TTL_MS).toISOString() }
          : item),
      },
      result: undefined,
    }));
  }
  return { ...session, accountId: account.id, accountVersion: account.version, account };
}

export async function getSessionsForAccount(accountId: string): Promise<Session[]> {
  const account = await getAccountById(accountId);
  if (!account?.enabled) return [];
  const { sessions } = await readJson(FILE, EMPTY);
  return sessions
    .filter((item) => item.accountId === accountId && item.accountVersion === account.version && alive(item))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export async function revokeAccountSession(accountId: string, id: string): Promise<void> {
  await updateJson(FILE, EMPTY, (value) => ({
    value: { sessions: value.sessions.filter((item) => item.accountId !== accountId || item.id !== id) },
    result: undefined,
  }));
}

export async function revokeOtherAccountSessions(accountId: string, keepId: string): Promise<void> {
  await updateJson(FILE, EMPTY, (value) => ({
    value: { sessions: value.sessions.filter((item) => item.accountId !== accountId || item.id === keepId) },
    result: undefined,
  }));
}

export async function clearSessionToken(token: string | undefined): Promise<void> {
  const id = verify(token);
  if (!id) return;
  await updateJson(FILE, EMPTY, (value) => ({
    value: { sessions: value.sessions.filter((item) => item.id !== id) }, result: undefined,
  }));
}
