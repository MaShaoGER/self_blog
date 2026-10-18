import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAllPostsAdmin } from "@/lib/posts";
import { formatDateShort, formatDateTime } from "@/lib/format";
import { AdminPage, EmptyState, PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { STATUS_LABEL, effectiveStatus, type EffectiveStatus } from "@/components/admin/post-status";
import { PostRow } from "@/components/admin/post-row";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "文章" };

type Filter = "all" | EffectiveStatus;
const FILTERS: Filter[] = ["all", "published", "scheduled", "draft"];

const EMPTY_COPY: Record<Filter, { title: string; body: string }> = {
  all: { title: "还没有文章", body: "写下第一篇，可以先存成草稿，准备好了再发布。" },
  published: { title: "还没有已发布的文章", body: "在编辑器里把状态改成「已发布」，文章就会出现在站点上。" },
  scheduled: { title: "没有定时发布的文章", body: "在编辑器里选择「定时」并设一个将来的时间，到点会自动上线。" },
  draft: { title: "没有草稿", body: "所有文章都已经发出去了。新的想法可以先存成草稿。" },
};

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: Filter = FILTERS.includes(status as Filter) ? (status as Filter) : "all";

  const now = Date.now();
  const all = (await getAllPostsAdmin()).map((p) => ({ ...p, eff: effectiveStatus(p, now) }));
  const counts = { all: all.length, published: 0, scheduled: 0, draft: 0 } as Record<Filter, number>;
  for (const p of all) counts[p.eff]++;

  const rows = filter === "all" ? all : all.filter((p) => p.eff === filter);
  // 定时文章按上线先后排，其余按日期倒序
  if (filter === "scheduled") rows.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <AdminPage>
      <PageHeader
        title="文章"
        className="border-b-0"
        actions={
          <Link href="/admin/posts/new" className="btn btn-primary h-11! md:h-10!">
            <Plus aria-hidden strokeWidth={2} className="size-4" />
            写新文章
          </Link>
        }
      />

      <FilterTabs
        label="按状态筛选"
        current={filter}
        tabs={FILTERS.map((f) => ({
          value: f,
          label: f === "all" ? "全部" : STATUS_LABEL[f],
          count: counts[f],
          href: f === "all" ? "/admin/posts" : `/admin/posts?status=${f}`,
        }))}
      />

      {rows.length ? (
        <ul className="divide-y divide-line border-b border-line">
          {rows.map((p) => (
            <PostRow
              key={p.slug}
              slug={p.slug}
              title={p.title}
              status={p.eff}
              viewable={p.eff === "published"}
              dateText={p.eff === "scheduled" ? formatDateTime(p.date) : formatDateShort(p.date)}
              dateIso={p.date}
              dateLabel={p.eff === "scheduled" ? "将于" : p.eff === "draft" ? "日期" : "发布于"}
              wordCount={p.wordCount}
              tags={p.tags}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          title={EMPTY_COPY[filter].title}
          action={
            <Link href="/admin/posts/new" className="btn btn-ghost h-11! md:h-10!">
              写新文章
            </Link>
          }
        >
          {EMPTY_COPY[filter].body}
        </EmptyState>
      )}
    </AdminPage>
  );
}
