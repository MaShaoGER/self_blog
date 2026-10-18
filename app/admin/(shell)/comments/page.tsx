import type { Metadata } from "next";
import { getAllComments } from "@/lib/comments";
import { getAllPostsAdmin } from "@/lib/posts";
import { formatDateTime } from "@/lib/format";
import type { CommentStatus } from "@/lib/types";
import { AdminPage, EmptyState, PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { CommentList } from "@/components/admin/comment-list";
import { effectiveStatus, postHref } from "@/components/admin/post-status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "评论" };

const TABS: { value: CommentStatus; label: string }[] = [
  { value: "pending", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "hidden", label: "已隐藏" },
];

const EMPTY_COPY: Record<CommentStatus, { title: string; body: string }> = {
  pending: { title: "没有待审核的评论", body: "新评论会先出现在这里，通过后才会在文章下显示。" },
  approved: { title: "还没有通过的评论", body: "到「待审核」里通过评论后，它会出现在对应文章下方。" },
  hidden: { title: "没有隐藏的评论", body: "隐藏的评论访客看不到，之后可以随时恢复。" },
};

export default async function CommentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const current: CommentStatus = TABS.some((t) => t.value === status) ? (status as CommentStatus) : "pending";

  const [comments, posts] = await Promise.all([getAllComments(), getAllPostsAdmin()]);
  const now = Date.now();
  const postInfo = new Map(posts.map((p) => [p.slug, { title: p.title, live: effectiveStatus(p, now) === "published" }]));

  const counts: Record<CommentStatus, number> = { pending: 0, approved: 0, hidden: 0 };
  for (const c of comments) counts[c.status]++;

  const items = comments
    .filter((c) => c.status === current)
    .map((c) => {
      const p = postInfo.get(c.postSlug);
      return {
        id: c.id,
        author: c.author,
        website: c.website,
        body: c.body,
        createdAt: c.createdAt,
        createdText: formatDateTime(c.createdAt),
        status: c.status,
        postTitle: p?.title ?? null,
        postHref: p?.live ? `${postHref(c.postSlug)}#comments` : null,
        postEditHref: p ? `/admin/posts/${c.postSlug}/edit` : null,
        postSlug: c.postSlug,
      };
    });

  return (
    <AdminPage>
      <PageHeader title="评论" className="border-b-0" description="通过的评论会显示在文章下方，隐藏的访客看不到。" />
      <FilterTabs
        label="按审核状态筛选"
        current={current}
        tabs={TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count: counts[t.value],
          href: t.value === "pending" ? "/admin/comments" : `/admin/comments?status=${t.value}`,
        }))}
      />
      {/* 始终渲染列表组件，最后一条处理完时反馈区不会被卸载 */}
      <CommentList
        key={current}
        items={items}
        empty={<EmptyState title={EMPTY_COPY[current].title}>{EMPTY_COPY[current].body}</EmptyState>}
      />
    </AdminPage>
  );
}
