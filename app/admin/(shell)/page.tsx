import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAllPostsAdmin } from "@/lib/posts";
import { getAllComments } from "@/lib/comments";
import { formatDateShort, formatDateTime } from "@/lib/format";
import { AdminPage, PageHeader } from "@/components/admin/page-header";
import { effectiveStatus, postHref } from "@/components/admin/post-status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "概览" };

function Section({
  title,
  more,
  children,
}: {
  title: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="pt-8">
      <div className="flex items-baseline justify-between border-b border-line-strong pb-2.5">
        <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
        {more && (
          <Link href={more.href} className="link-underline -my-3 py-3 text-[0.8125rem] text-muted">
            {more.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function AdminHome() {
  const [posts, comments] = await Promise.all([getAllPostsAdmin(), getAllComments()]);
  const now = Date.now();

  const withStatus = posts.map((p) => ({ ...p, eff: effectiveStatus(p, now) }));
  const drafts = withStatus
    .filter((p) => p.eff === "draft")
    .sort((a, b) => (b.updated ?? b.date).localeCompare(a.updated ?? a.date))
    .slice(0, 5);
  const scheduled = withStatus.filter((p) => p.eff === "scheduled").sort((a, b) => a.date.localeCompare(b.date));
  const published = withStatus.filter((p) => p.eff === "published").slice(0, 5);
  const publishedCount = withStatus.filter((p) => p.eff === "published").length;
  const draftCount = withStatus.filter((p) => p.eff === "draft").length;
  const pending = comments.filter((c) => c.status === "pending");
  const titleOf = new Map(posts.map((p) => [p.slug, p.title]));

  return (
    <AdminPage>
      <PageHeader
        title="概览"
        description={
          posts.length
            ? `共 ${posts.length} 篇文章，${publishedCount} 篇已发布，${draftCount} 篇草稿`
            : "还没有文章，从写第一篇开始。"
        }
        actions={
          <Link href="/admin/posts/new" className="btn btn-primary h-11! md:h-10!">
            <Plus aria-hidden strokeWidth={2} className="size-4" />
            写新文章
          </Link>
        }
      />

      {/* 待审核评论：有才强调，没有就一句话带过 */}
      <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line py-5">
        <div className="flex items-baseline gap-3">
          <span
            className={
              pending.length
                ? "display text-[2rem] leading-none tabular-nums text-accent"
                : "display text-[2rem] leading-none tabular-nums text-faint"
            }
          >
            {pending.length}
          </span>
          <span className="text-[0.9375rem] text-ink-soft">
            {pending.length ? "条评论等待审核" : "条待审核评论，评论区很清净"}
          </span>
        </div>
        {pending.length > 0 && (
          <Link href="/admin/comments" className="btn btn-ghost h-11! md:h-10!">
            去审核评论
          </Link>
        )}
      </section>

      {pending.length > 0 && (
        <ul className="divide-y divide-line border-b border-line">
          {pending.slice(0, 3).map((c) => (
            <li key={c.id} className="py-3.5">
              <p className="line-clamp-2 text-[0.875rem] leading-relaxed text-ink-soft">{c.body}</p>
              <p className="mt-1 text-[0.8125rem] text-muted">
                {c.author}，评论于《{titleOf.get(c.postSlug) ?? c.postSlug}》，
                <time dateTime={c.createdAt}>{formatDateTime(c.createdAt)}</time>
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-x-10 md:grid-cols-2">
        <Section title="最近的草稿" more={drafts.length ? { href: "/admin/posts?status=draft", label: "全部草稿" } : undefined}>
          {drafts.length ? (
            <ul className="divide-y divide-line">
              {drafts.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/admin/posts/${p.slug}/edit`}
                    className="group flex min-h-12 items-center justify-between gap-4 py-3"
                  >
                    <span className="min-w-0 truncate text-[0.9375rem] text-ink group-hover:text-accent-ink">
                      {p.title}
                    </span>
                    <span className="shrink-0 text-[0.8125rem] tabular-nums text-muted">
                      {p.wordCount} 字
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-[0.875rem] leading-relaxed text-muted">
              没有草稿。想到什么就先
              <Link href="/admin/posts/new" className="link-underline mx-0.5 text-ink-soft">
                写几句
              </Link>
              ，存成草稿慢慢改。
            </p>
          )}
        </Section>

        <Section
          title="最近发布"
          more={published.length ? { href: "/admin/posts?status=published", label: "全部已发布" } : undefined}
        >
          {published.length ? (
            <ul className="divide-y divide-line">
              {published.map((p) => (
                <li key={p.slug} className="flex min-h-12 items-center justify-between gap-4 py-3">
                  <a
                    href={postHref(p.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate text-[0.9375rem] text-ink hover:text-accent-ink"
                  >
                    {p.title}
                  </a>
                  <time dateTime={p.date} className="shrink-0 text-[0.8125rem] tabular-nums text-muted">
                    {formatDateShort(p.date)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-[0.875rem] leading-relaxed text-muted">
              还没有发布过文章。写好之后在编辑器里把状态改成"已发布"，就会出现在这里。
            </p>
          )}
        </Section>
      </div>

      {scheduled.length > 0 && (
        <Section title="即将发布" more={{ href: "/admin/posts?status=scheduled", label: "全部定时" }}>
          <ul className="divide-y divide-line">
            {scheduled.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/admin/posts/${p.slug}/edit`}
                  className="group flex min-h-12 items-center justify-between gap-4 py-3"
                >
                  <span className="min-w-0 truncate text-[0.9375rem] text-ink group-hover:text-accent-ink">{p.title}</span>
                  <time dateTime={p.date} className="shrink-0 text-[0.8125rem] tabular-nums text-accent-ink">
                    {formatDateTime(p.date)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </AdminPage>
  );
}
