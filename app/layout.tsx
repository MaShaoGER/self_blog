import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/archivo/wght.css";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: s.title, template: `%s — ${s.title}` },
    description: s.description,
    alternates: { types: { "application/rss+xml": "/feed.xml" } },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EFEBE3" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

// Runs before paint so the stored/system theme is applied without a flash.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;if(d){r.classList.add("dark");r.style.colorScheme="dark"}}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 由 proxy.ts 逐请求生成；Next 的内联引导脚本也会自动带上同一 nonce。
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="relative z-[1] flex min-h-dvh flex-col">{children}</div>
      </body>
    </html>
  );
}
