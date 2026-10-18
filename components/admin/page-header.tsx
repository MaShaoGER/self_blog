import { cn } from "@/lib/cn";

/** 后台页面统一的标题区：左侧标题与说明，右侧放主操作。 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-5 pt-6 md:pt-10",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[1.375rem] font-semibold tracking-[-0.01em] text-ink md:text-[1.5rem]">{title}</h1>
        {description && <p className="mt-1.5 text-[0.875rem] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** 页面内容容器，与左侧栏对齐的统一内边距。 */
export function AdminPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[60rem] px-4 pb-16 md:px-10", className)}>{children}</div>;
}

/** 空状态：说清楚现在是什么情况，下一步做什么。 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line py-14 text-center">
      <p className="text-[0.9375rem] font-medium text-ink">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-[0.875rem] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
