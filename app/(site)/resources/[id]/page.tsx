import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getResource } from "@/lib/resources";
import { ResourcePreview } from "@/components/resources/resource-preview";
import type { ResourceKind } from "@/shared/resource-types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "资源预览", robots: { index: false, follow: false } };
const labels: Record<ResourceKind, string> = { folder: "目录", video: "视频", model: "三维模型", image: "图片", file: "工程 / 文件" };

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const record = await getResource(id, Boolean(session));
  if (!record) notFound();
  const { source: _source, ...resource } = record;
  const back = resource.parentId ? `/resources?folder=${encodeURIComponent(resource.parentId)}` : "/resources";
  return (
    <div className="wrap py-8 lg:py-12">
      <Link href={back} className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4">返回所属目录</Link>
      <header className="mt-4 mb-8 border-b border-line pb-6">
        <p className="mb-3 text-xs text-muted">{labels[resource.kind]}{resource.visibility === "private" ? " · 仅后台账号可访问" : ""}</p>
        <h1 className="display break-words text-[clamp(1.75rem,5vw,3.5rem)]">{resource.name}</h1>
        {resource.description ? <p className="mt-4 max-w-[64ch] whitespace-pre-wrap break-words text-base leading-relaxed text-ink-soft">{resource.description}</p> : null}
      </header>
      <div className="max-w-[64rem]">
        <ResourcePreview resource={resource} />
      </div>
    </div>
  );
}
