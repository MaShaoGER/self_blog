import { AdminPage } from "@/components/admin/page-header";
import { Ruler } from "@/components/ui/marks";

/** 后台路由切换占位：参数表骨架，不闪白屏。 */
export default function AdminLoading() {
  return (
    <AdminPage>
      <span className="sr-only">正在载入</span>
      <div className="border-b border-line pb-5 pt-6 md:pt-10" aria-busy="true">
        <div className="h-7 w-32 bg-[color-mix(in_oklab,var(--ink)_9%,transparent)]" />
        <div className="mt-3 h-4 w-64 bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]" />
      </div>

      <Ruler className="mt-6 text-line-strong" ticks={24} />

      <div className="mt-6 border-t border-line">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div
                className="h-4 bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]"
                style={{ width: `${68 - i * 6}%` }}
              />
              <div className="h-3 w-24 bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]" />
            </div>
            <div className="h-3 w-16 shrink-0 bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]" />
          </div>
        ))}
      </div>
    </AdminPage>
  );
}
