import { headers } from "next/headers";

/**
 * Client IP as reported by the reverse proxy (Caddy sets X-Forwarded-For).
 * The app port must not be reachable directly, otherwise this header can be spoofed.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "0.0.0.0";
}

export function maskIp(ip: string): string {
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) → treat as IPv4
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) ip = mapped[1];
  if (ip === "::1") return "本机";
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return `${parts.slice(0, 3).join(":")}:*`;
  }
  if (ip.startsWith("127.")) return "本机";
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.*` : ip;
}

/** Short human label from a user agent, e.g. "iPhone · Safari". */
export function describeDevice(ua: string | null): string {
  if (!ua) return "未知设备";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "其他系统";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /MicroMessenger/.test(ua)
      ? "微信"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "浏览器";
  return `${os} · ${browser}`;
}

/** Reject cross-site requests to route handlers (Server Actions already check Origin). */
export async function assertSameOrigin(req: Request): Promise<void> {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetches from older browsers may omit it; cookie is SameSite=Lax
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) {
    throw new Response("跨站请求被拒绝", { status: 403 });
  }
}
