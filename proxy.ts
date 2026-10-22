import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP 由这里逐请求生成：nonce 每请求唯一，页面里的内联主题脚本和 Next 的
 * 引导脚本都靠它通过严格的 script-src。开发模式下额外放开 eval 与 HMR 的
 * websocket，生产模式则强制升级到 HTTPS。
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "media-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * 两件事：
 * 1. 便宜的闸门：没有会话 Cookie 的访客访问 /admin 直接回登录页。
 *    真正的校验（签名 + 吊销）在 requireAdmin()/assertAdmin()。
 * 2. 为每个页面请求生成 CSP nonce（静态资源与 API 不需要）。
 */
export function proxy(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next 会从这个请求头里取出 nonce，加到它自己输出的 script 标签上。
  requestHeaders.set("Content-Security-Policy", csp);

  const isAdmin = req.nextUrl.pathname.startsWith("/admin");
  let response: NextResponse;
  if (isAdmin && !req.cookies.has("blog_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // 只处理页面请求：静态资源、图片、上传文件与 API 不需要 nonce。
  matcher: ["/((?!api|_next/static|_next/image|uploads|favicon.ico|icon.svg).*)"],
};
