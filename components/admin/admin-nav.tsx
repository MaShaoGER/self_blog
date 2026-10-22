"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  FileText,
  FolderOpen,
  Images,
  LayoutGrid,
  LogOut,
  MessageSquare,
  MonitorSmartphone,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { StatusLine } from "@/components/ui/marks";
import type { AccountRole } from "@/lib/account-types";

type Item = { href: string; label: string; en: string; icon: LucideIcon; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/admin", label: "概览", en: "OVERVIEW", icon: LayoutGrid },
  { href: "/admin/posts", label: "文章", en: "ENTRIES", icon: FileText },
  { href: "/admin/comments", label: "评论", en: "COMMENTS", icon: MessageSquare },
  { href: "/admin/media", label: "图库", en: "MEDIA", icon: Images },
  { href: "/admin/projects", label: "项目", en: "PROJECTS", icon: FolderOpen, adminOnly: true },
  { href: "/admin/accounts", label: "账号管理", en: "ACCOUNTS", icon: Users, adminOnly: true },
  { href: "/admin/devices", label: "我的账号", en: "ACCOUNT", icon: MonitorSmartphone },
  { href: "/admin/settings", label: "设置", en: "SETTINGS", icon: SlidersHorizontal, adminOnly: true },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/** 待审数量：方形标签，不用圆点气泡 */
function Badge({ count, compact }: { count: number; compact?: boolean }) {
  if (count <= 0) return null;
  const text = compact && count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn(
        "mono inline-flex items-center justify-center bg-accent px-1 leading-none text-white tabular-nums",
        compact ? "h-3.5 min-w-3.5 text-[0.625rem]" : "h-4 min-w-4 text-[0.625rem]",
      )}
    >
      {text}
    </span>
  );
}

/**
 * 后台导航：控制台侧栏。
 * 可读性优先，但沿用编号与结构线语言；与前台共用主题拨杆与 LED 状态。
 */
export function AdminNav({
  pending,
  siteTitle,
  accountRole,
  accountName,
  logout,
}: {
  pending: number;
  siteTitle: string;
  accountRole: AccountRole;
  accountName: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => !item.adminOnly || accountRole === "admin");
  const badgeLabel = pending > 0 ? `，${pending} 条待审核` : "";

  return (
    <>
      {/* 桌面：左侧栏 */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line-strong md:flex">
        <div className="flex h-16 shrink-0 flex-col justify-center border-b border-line px-4">
          <Link href="/admin" className="display min-w-0 truncate text-[1rem] leading-none text-ink">
            {siteTitle}
          </Link>
          <span className="mono mt-1.5 truncate text-[0.625rem] tracking-[0.08em] text-faint">{accountName} / {accountRole === "admin" ? "管理员" : "编辑"}</span>
        </div>

        <nav aria-label="后台导航" className="flex-1 overflow-y-auto py-2">
          <ul>
            {items.map(({ href, label, en, icon: Icon }) => {
              const active = isActive(pathname, href);
              const count = href === "/admin/comments" ? pending : 0;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 border-l-2 py-2.5 pr-3 pl-3.5 text-[0.8125rem] transition-colors",
                      active
                        ? "border-l-accent bg-surface text-ink"
                        : "border-l-transparent text-ink-soft hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] hover:text-ink",
                    )}
                  >
                    <Icon
                      aria-hidden
                      strokeWidth={1.6}
                      className={cn("size-4 shrink-0", active ? "text-accent" : "text-muted group-hover:text-ink-soft")}
                    />
                    <span className="flex-1 truncate">{label}</span>
                    {count > 0 ? (
                      <>
                        <Badge count={count} />
                        <span className="sr-only">{badgeLabel}</span>
                      </>
                    ) : (
                      <span
                        aria-hidden
                        className="mono hidden text-[0.5625rem] tracking-[0.1em] text-faint uppercase group-hover:inline"
                      >
                        {en}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-line px-3.5 py-3">
          <StatusLine status="online" className="mb-3">
            SYS.LOCAL
          </StatusLine>

          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 py-2 text-[0.8125rem] text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowUpRight aria-hidden strokeWidth={1.6} className="size-4 text-muted" />
            查看站点
            <span className="sr-only">（新窗口打开）</span>
          </a>

          <form action={logout}>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-2.5 py-2 text-left text-[0.8125rem] text-ink-soft transition-colors hover:text-ink"
            >
              <LogOut aria-hidden strokeWidth={1.6} className="size-4 text-muted" />
              退出登录
            </button>
          </form>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">LGT / DRK</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* 移动端：顶部条 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line-strong bg-[color-mix(in_oklab,var(--paper)_94%,transparent)] pl-4 backdrop-blur-[2px] md:hidden">
        <div className="flex min-w-0 items-baseline gap-2">
          <Link href="/admin" className="display min-w-0 truncate text-[0.9375rem] leading-none text-ink">
            {siteTitle}
          </Link>
          <span className="mono shrink-0 text-[0.5625rem] tracking-[0.14em] text-faint">{accountRole === "admin" ? "管理员" : "编辑"}</span>
        </div>
        <div className="flex items-center gap-1 pr-1">
          <ThemeToggle className="mr-1" />
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            aria-label="查看站点（新窗口打开）"
            className="inline-flex size-10 items-center justify-center text-muted transition-colors hover:text-ink"
          >
            <ArrowUpRight aria-hidden strokeWidth={1.6} className="size-[1.05rem]" />
          </a>
          <form action={logout}>
            <button
              type="submit"
              aria-label="退出登录"
              className="inline-flex size-10 cursor-pointer items-center justify-center text-muted transition-colors hover:text-ink"
            >
              <LogOut aria-hidden strokeWidth={1.6} className="size-4" />
            </button>
          </form>
        </div>
      </header>

      {/* 移动端：底部 tab */}
      <nav
        aria-label="后台导航"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-[color-mix(in_oklab,var(--paper)_96%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-[2px] md:hidden"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            const count = href === "/admin/comments" ? pending : 0;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-[3.75rem] flex-col items-center justify-center gap-1 text-[0.625rem] transition-colors",
                    active ? "text-accent-ink" : "text-muted",
                  )}
                >
                  {active && <span aria-hidden className="absolute inset-x-3 top-0 h-[2px] bg-accent" />}
                  <span className="relative">
                    <Icon aria-hidden strokeWidth={active ? 1.9 : 1.6} className="size-[1.15rem]" />
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-2.5">
                        <Badge count={count} compact />
                      </span>
                    )}
                  </span>
                  <span>{label}</span>
                  {count > 0 && <span className="sr-only">{badgeLabel}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
