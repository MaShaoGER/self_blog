import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <>
      <a
        href="#main"
        className="keybtn no-print sr-only z-50 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        跳到正文
      </a>
      <SiteHeader title={s.title} tagline={s.tagline} />
      <main id="main" className="relative flex-1">
        {children}
      </main>
      <SiteFooter title={s.title} author={s.author} />
    </>
  );
}
