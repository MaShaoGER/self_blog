import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Keyed hash so raw visitor IPs are never stored on disk and can't be reversed
 * by brute-forcing the (small) IPv4 space without the server secret.
 */
export function hashIp(ip: string): string {
  const secret = process.env.BLOG_SESSION_SECRET ?? "self-blog";
  return createHmac("sha256", `ip:${secret}`).update(ip).digest("hex").slice(0, 24);
}

export function safeEqual(a: string, b: string): boolean {
  // Compare fixed-length digests so length differences don't leak through timing.
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

export function randomId(): string {
  return crypto.randomUUID();
}

/** Cryptographically random URL-safe token carrying `bytes` bytes of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
