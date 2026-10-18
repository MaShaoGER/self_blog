import { siteUrl } from "@/lib/env";
import { getLivePosts } from "@/lib/posts";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s
    // Strip characters that are illegal in XML 1.0.
    .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const [posts, s] = await Promise.all([getLivePosts(), getSettings()]);
  const base = siteUrl();
  const latest = posts.slice(0, 20);

  const items = latest
    .map((p) => {
      const link = `${base}/posts/${p.slug}`;
      return [
        "    <item>",
        `      <title>${esc(p.title)}</title>`,
        `      <link>${esc(link)}</link>`,
        `      <guid isPermaLink="true">${esc(link)}</guid>`,
        `      <pubDate>${new Date(p.date).toUTCString()}</pubDate>`,
        p.excerpt ? `      <description>${esc(p.excerpt)}</description>` : "",
        ...p.tags.map((t) => `      <category>${esc(t)}</category>`),
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(s.title)}</title>
    <link>${esc(base)}/</link>
    <description>${esc(s.description || s.tagline)}</description>
    <language>zh-CN</language>
    <atom:link href="${esc(`${base}/feed.xml`)}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date(latest[0]?.updated ?? latest[0]?.date ?? Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600",
    },
  });
}
