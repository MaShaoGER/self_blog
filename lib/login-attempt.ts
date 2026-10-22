import { authenticateAccount } from "./accounts";
import type { PublicAccount } from "./account-types";
import { hit, reset } from "./rate-limit";

export type LoginAttemptResult =
  | { status: "authenticated"; account: PublicAccount }
  | { status: "invalid" | "limited" };

const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function attemptLogin(ip: string, username: unknown, password: unknown): Promise<LoginAttemptResult> {
  const key = `login:${ip}`;
  if (!hit(key, LIMIT, WINDOW_MS).ok) return { status: "limited" };
  const account = typeof username === "string" && username.length <= 32 &&
    typeof password === "string" && password.length > 0
    ? await authenticateAccount(username, password) : null;
  if (!account) return { status: "invalid" };
  reset(key);
  return { status: "authenticated", account };
}
