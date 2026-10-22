import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";
import { Barcode, Ruler } from "@/components/ui/marks";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "登录", robots: { index: false } };

/**
 * 登录页 = 控制台：深色底、mono、版本号、状态灯。
 * 站内唯一常年深色的页面——进门的地方是机柜，不是前台。
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; changed?: string }> }) {
  const [{ next, changed }, session, settings] = await Promise.all([searchParams, getSession(), getSettings()]);
  if (session) redirect("/admin");

  return (
    <main
      className="relative flex min-h-dvh flex-1 flex-col"
      style={{ backgroundColor: "#111113", color: "#e8e4da" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(232,228,218,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(232,228,218,0.25) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-[1] mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center px-5 py-14">
        <div className="w-full min-w-0 border border-[#3a3a3e]" style={{ backgroundColor: "#1a1a1c" }}>
          <div className="flex items-center justify-between border-b border-[#3a3a3e] px-4 py-2.5">
            <span className="mono text-[0.625rem] tracking-[0.16em] text-[#8e8a80] uppercase">AUTH / CTL-01</span>
            <span className="mono text-[0.625rem] tracking-[0.16em] text-[#8e8a80]">REV.02</span>
          </div>

          <div className="min-w-0 px-5 pt-6 pb-5">
            <div className="flex items-baseline justify-between gap-3">
              <a href="/" className="display text-[1.375rem] leading-none text-[#efebe3]">
                {settings.title}
              </a>
              <span className="mono flex items-center gap-1.5 text-[0.625rem] tracking-[0.14em] text-[#8e8a80] uppercase">
                <span aria-hidden className="inline-block size-1.5 rounded-full bg-[#5fbf6f]" style={{ boxShadow: "0 0 6px #5fbf6f" }} />
                STANDBY
              </span>
            </div>

            <p className="mono mt-1.5 text-[0.625rem] tracking-[0.14em] text-[#6b6862] uppercase">
              {settings.author} / TEAM ACCESS
            </p>

            <h1 className="mt-7 text-[1.5rem] leading-tight text-[#efebe3]">回到书桌</h1>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-[#a8a399]">
              使用管理员分配的用户名和密码登录。登录状态在这台设备上保留 30 天。
            </p>

            {changed === "1" && <p role="status" className="mt-3 text-[0.8125rem] text-[#8fd19a]">密码已更新，请重新登录。</p>}

            <LoginForm next={next ?? "/admin"} />
          </div>

          <div className="flex items-end justify-between gap-3 border-t border-[#3a3a3e] px-5 py-3">
            <div className="min-w-0">
              <Ruler className="text-[#4a463d]" ticks={20} />
              <p className="mono mt-1 text-[0.625rem] tracking-[0.14em] text-[#6b6862] uppercase">
                LOCAL ACCESS / PORT 3000
              </p>
            </div>
            <Barcode value={`AUTH/${settings.title}/CTL-01`} className="h-5 w-16 text-[#6b6862]" />
          </div>
        </div>

        <p className="mono mt-4 flex items-center justify-between gap-3 text-[0.625rem] tracking-[0.14em] text-[#6b6862] uppercase">
          <a href="/" className="hover:text-[#e8e4da]">
            ← 返回站点
          </a>
          <span>SELF_BLOG / 2026</span>
        </p>
      </div>
    </main>
  );
}
