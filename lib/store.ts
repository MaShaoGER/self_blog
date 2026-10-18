import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/** Write via temp file + rename so readers never observe a half-written file. */
export async function atomicWrite(file: string, data: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmp, data);
  try {
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`);
}

// Per-file promise chains serialise read-modify-write cycles within this process.
const g = globalThis as unknown as { __blogLocks?: Map<string, Promise<unknown>> };
const locks = (g.__blogLocks ??= new Map());

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const settled = next.catch(() => undefined);
  locks.set(key, settled);
  void settled.then(() => {
    if (locks.get(key) === settled) locks.delete(key);
  });
  return next;
}

/** Read-modify-write a JSON file under a lock. */
export function updateJson<T, R>(file: string, fallback: T, fn: (value: T) => { value: T; result: R }): Promise<R> {
  return withLock(file, async () => {
    const current = await readJson(file, fallback);
    const { value, result } = fn(current);
    await writeJson(file, value);
    return result;
  });
}
