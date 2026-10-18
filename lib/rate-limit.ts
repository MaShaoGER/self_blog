type Bucket = { count: number; resetAt: number };

const g = globalThis as unknown as { __blogRate?: Map<string, Bucket> };
const buckets = (g.__blogRate ??= new Map());

/** Fixed-window counter kept in memory; fine for a single-instance personal blog. */
export function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

export function peek(key: string, limit: number): boolean {
  const b = buckets.get(key);
  return !b || b.resetAt <= Date.now() || b.count < limit;
}

export function reset(key: string): void {
  buckets.delete(key);
}
