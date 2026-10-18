import type { Metadata } from "next";
import Link from "next/link";
import { getLivePosts } from "@/lib/posts";
import { PostIndex } from "@/components/site/post-index";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tag: string }> };

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = decode((await params).tag);
  return { title: `标签：${tag}` };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 标签页 = 单卷档案。
 * 面包屑回链是唯一的结构标记，其余靠编号与计数承载信息。
 */
export default async function TagPage({ params }: Props) {
  const tag = decode((await params).tag);
  const posts = (await getLivePosts()).filter((p) => p.tags.includes(tag));

  return (
    <div className="sheet">
      <header className="wrap border-b border-line-ink pt-8 pb-8 lg:pt-10 lg:pb-10">
        <nav aria-label="面包屑" className="mono flex items-baseline gap-2 text-[0.6875rem] tracking-[0.12em] uppercase">
          <Link href="/tags" className="text-muted transition-colors hover:text-accent-ink">
            标签索引
          </Link>
          <span aria-hidden className="text-faint">
            /
          </span>
          <span className="text-ink">单卷</span>
        </nav>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <h1 className="display text-[clamp(2.25rem,7vw,4.5rem)] break-words">{tag}</h1>
            <p className="mt-3 leading-relaxed text-muted">
              {posts.length > 0 ? "该标签下的全部文章，按发布时间倒序排列。" : "这个标签下还没有文章。"}
            </p>
          </div>

          <p className="mono shrink-0 text-[0.8125rem] tracking-[0.1em] text-ink uppercase tabular-nums">
            {pad2(posts.length)} ENTRIES
            <span aria-hidden className="mx-1.5 text-faint">
              /
            </span>
            TAG
          </p>
        </div>
      </header>

      <section aria-labelledby="tag-entries" className="wrap py-8 lg:py-10">
        <div className="mb-6 flex items-end justify-between gap-6">
          <h2 id="tag-entries" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
            INDEX / 目录
          </h2>
          <span aria-hidden className="mono hidden text-[0.625rem] tracking-[0.08em] text-faint uppercase sm:block">
            NO. · TITLE · DATE · CAT · MIN
          </span>
        </div>

        {posts.length === 0 ? (
          <div className="border-t border-line-ink py-14">
            <p className="display text-[1.5rem] text-ink">NO RECORDS</p>
            <p className="mt-2 max-w-[52ch] text-muted">
              换个标签看看，或者回到
              <Link href="/tags" className="link-underline mx-1 text-ink-soft">
                标签索引
              </Link>
              。
            </p>
          </div>
        ) : (
          <PostIndex posts={posts} compact />
        )}
      </section>
    </div>
  );
}
