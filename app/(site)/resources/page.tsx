import type { Metadata } from "next";
import { ResourceBrowser } from "@/components/resources/resource-browser";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "工程与资源" };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ folder?: string | string[] }> }) {
  const query = await searchParams;
  const folder = typeof query.folder === "string" ? query.folder : undefined;
  return (
    <div>
      <header className="wrap border-b border-line-strong py-9 lg:py-12">
        <h1 className="display text-[clamp(2.25rem,7vw,4rem)]">工程与资源</h1>
        <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-ink-soft">视频成片、模型和工程素材。打开目录浏览，点击文件查看预览或下载。</p>
      </header>
      <section className="wrap py-7 lg:py-10" aria-label="资源目录">
        <ResourceBrowser key={folder ?? "root"} initialParentId={folder} />
      </section>
    </div>
  );
}
