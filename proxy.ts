import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap gate: bounce visitors without a session cookie away from /admin.
 * The real check (signature + revocation) happens in requireAdmin()/assertAdmin().
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has("blog_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
