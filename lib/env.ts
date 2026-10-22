import path from "node:path";
import { resolveDataDir } from "./data-path.mjs";

// Runtime data lives outside the build; tell Turbopack not to trace it into the bundle.
export const DATA_DIR = path.resolve(
  /*turbopackIgnore: true*/ resolveDataDir(),
);
export const POSTS_DIR = path.join(DATA_DIR, "posts");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function adminPassword(): string {
  const pw = process.env.BLOG_ADMIN_PASSWORD;
  if (!pw || pw.length < 8) {
    throw new Error("BLOG_ADMIN_PASSWORD 未设置或少于 8 位，请在 .env.local 中配置");
  }
  return pw;
}

export function sessionSecret(): string {
  const s = process.env.BLOG_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("BLOG_SESSION_SECRET 未设置或少于 32 位，请在 .env.local 中配置");
  }
  return s;
}
