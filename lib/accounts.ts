import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR, adminPassword } from "./env";
import { readJson, withLock, writeJson } from "./store";
import type { CreateAccountInput, PublicAccount, UpdateAccountInput } from "./account-types";

export type { AccountRole, PublicAccount, CreateAccountInput, UpdateAccountInput } from "./account-types";

interface StoredAccount extends PublicAccount {
  passwordHash: string;
}

const file = path.join(DATA_DIR, "accounts.json");
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const hashPattern = /^scrypt\$1\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{64})$/;

export class AccountError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status: number = 400) {
    super(message);
    this.name = "AccountError";
    this.code = code;
    this.status = status;
  }
}

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, options, (error, key) => error ? reject(error) : resolve(key));
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$1$32768$8$3$${salt}$${(await derive(password, salt)).toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const match = hashPattern.exec(encoded);
  if (!match) throw new Error("账号数据中的密码格式无效");
  return timingSafeEqual(await derive(password, match[1]), Buffer.from(match[2], "hex"));
}

function publicAccount(account: StoredAccount): PublicAccount {
  const { passwordHash: _passwordHash, ...result } = account;
  return result;
}

async function readAccounts(): Promise<StoredAccount[]> {
  const missing = Symbol("missing");
  const value = await readJson<unknown>(file, missing);
  if (value === missing) {
    const now = new Date().toISOString();
    const account: StoredAccount = {
      id: randomUUID(), username: "admin", displayName: "管理员", role: "admin", enabled: true,
      version: 1, createdAt: now, updatedAt: now, passwordHash: await hashPassword(adminPassword()),
    };
    await saveAccounts([account]);
    return [account];
  }
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) =>
    item && typeof item.id === "string" && item.id.length > 0 && typeof item.username === "string" &&
    /^[a-z0-9][a-z0-9_-]{2,31}$/.test(item.username) && typeof item.displayName === "string" &&
    item.displayName.trim().length >= 1 && item.displayName.length <= 60 &&
    (item.role === "admin" || item.role === "editor") && typeof item.enabled === "boolean" &&
    Number.isSafeInteger(item.version) && item.version >= 1 &&
    typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === "string" && Number.isFinite(Date.parse(item.updatedAt)) &&
    typeof item.passwordHash === "string" && hashPattern.test(item.passwordHash)
  ) || new Set(value.map((item) => item.id)).size !== value.length ||
    new Set(value.map((item) => item.username)).size !== value.length ||
    !value.some((item) => item.role === "admin" && item.enabled)) {
    throw new Error("账号数据损坏或没有可用管理员，请从备份恢复");
  }
  return value as StoredAccount[];
}

export async function ensureAccounts(): Promise<PublicAccount[]> {
  return withLock(file, async () => (await readAccounts()).map(publicAccount));
}

export const listAccounts = ensureAccounts;

export async function authenticateAccount(username: string, password: string): Promise<PublicAccount | null> {
  return withLock(file, async () => {
    const rows = await readAccounts();
    const account = rows.find((item) => item.username === username.trim().toLowerCase());
    const encoded = account?.passwordHash ?? `scrypt$1$32768$8$3$${"0".repeat(32)}$${"0".repeat(64)}`;
    const valid = await verifyPassword(password, encoded);
    return account && account.enabled && valid ? publicAccount(account) : null;
  });
}

async function saveAccounts(rows: StoredAccount[]): Promise<void> {
  await writeJson(file, rows);
  await fs.chmod(file, 0o600);
}

function validatePassword(password: string): void {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new AccountError("密码须为 12–128 位", "validation");
  }
}

function validateDisplayName(value: string): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 60) {
    throw new AccountError("显示名称须为 1–60 字", "validation");
  }
  return value.trim();
}

function validateRole(role: unknown): asserts role is "admin" | "editor" {
  if (role !== "admin" && role !== "editor") throw new AccountError("角色无效", "validation");
}

function requireAdmin(rows: StoredAccount[], actorId: string): StoredAccount {
  const actor = rows.find((item) => item.id === actorId);
  if (!actor || !actor.enabled || actor.role !== "admin") {
    throw new AccountError("只有可用管理员可以管理账号", "forbidden", 403);
  }
  return actor;
}

function requireAccount(rows: StoredAccount[], id: string): StoredAccount {
  const account = rows.find((item) => item.id === id);
  if (!account) throw new AccountError("账号不存在", "not_found", 404);
  return account;
}

export async function getAccountById(id: string): Promise<PublicAccount | null> {
  return withLock(file, async () => {
    const account = (await readAccounts()).find((item) => item.id === id);
    return account ? publicAccount(account) : null;
  });
}

export async function getSessionAccount(identity: { accountId?: string; accountVersion?: number }): Promise<PublicAccount | null> {
  if (!identity.accountId || !Number.isSafeInteger(identity.accountVersion)) return null;
  const account = await getAccountById(identity.accountId);
  return account && account.enabled && account.version === identity.accountVersion ? account : null;
}

export async function createAccount(actorId: string, input: CreateAccountInput): Promise<PublicAccount> {
  return withLock(file, async () => {
    const rows = await readAccounts();
    requireAdmin(rows, actorId);
    const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
    if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username)) {
      throw new AccountError("用户名须为 3–32 位字母、数字、下划线或连字符，以字母或数字开头", "validation");
    }
    const displayName = validateDisplayName(input.displayName);
    validateRole(input.role);
    validatePassword(input.password);
    if (rows.some((item) => item.username === username)) throw new AccountError("用户名已存在", "conflict", 409);
    const now = new Date().toISOString();
    const account: StoredAccount = {
      id: randomUUID(), username, displayName, role: input.role, enabled: true, version: 1,
      createdAt: now, updatedAt: now, passwordHash: await hashPassword(input.password),
    };
    rows.push(account);
    await saveAccounts(rows);
    return publicAccount(account);
  });
}

export async function updateAccount(actorId: string, id: string, input: UpdateAccountInput): Promise<PublicAccount> {
  return withLock(file, async () => {
    const rows = await readAccounts();
    requireAdmin(rows, actorId);
    const account = requireAccount(rows, id);
    if (input.role !== undefined) validateRole(input.role);
    if (input.enabled !== undefined && typeof input.enabled !== "boolean") throw new AccountError("账号状态无效", "validation");
    const displayName = input.displayName === undefined ? account.displayName : validateDisplayName(input.displayName);
    const role = input.role ?? account.role;
    const enabled = input.enabled ?? account.enabled;
    if (id === actorId && (!enabled || role !== "admin")) {
      throw new AccountError("不能停用或降级当前管理员账号", "self_lockout", 409);
    }
    if (account.role === "admin" && account.enabled && (!enabled || role !== "admin") &&
      rows.filter((item) => item.role === "admin" && item.enabled).length <= 1) {
      throw new AccountError("必须保留至少一个可用管理员", "last_admin", 409);
    }
    if (role !== account.role || enabled !== account.enabled) account.version++;
    Object.assign(account, { role, enabled, displayName, updatedAt: new Date().toISOString() });
    await saveAccounts(rows);
    return publicAccount(account);
  });
}

export async function resetAccountPassword(actorId: string, id: string, password: string): Promise<void> {
  await withLock(file, async () => {
    const rows = await readAccounts();
    requireAdmin(rows, actorId);
    const account = requireAccount(rows, id);
    validatePassword(password);
    account.passwordHash = await hashPassword(password);
    account.version++;
    account.updatedAt = new Date().toISOString();
    await saveAccounts(rows);
  });
}

export async function changeOwnPassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
  await withLock(file, async () => {
    const rows = await readAccounts();
    const account = requireAccount(rows, accountId);
    if (!account.enabled) throw new AccountError("账号已停用", "forbidden", 403);
    validatePassword(newPassword);
    if (!await verifyPassword(currentPassword, account.passwordHash)) throw new AccountError("当前密码不正确", "invalid_password");
    account.passwordHash = await hashPassword(newPassword);
    account.version++;
    account.updatedAt = new Date().toISOString();
    await saveAccounts(rows);
  });
}
