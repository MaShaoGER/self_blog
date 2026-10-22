import type { Metadata } from "next";
import { listSessions, requireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { AdminPage, PageHeader } from "@/components/admin/page-header";
import { DeviceList } from "@/components/admin/device-list";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的账号" };

export default async function DevicesPage() {
  const me = await requireSession();
  const sessions = await listSessions(me.accountId);
  // 当前设备置顶，其余按最后活跃倒序（listSessions 已排好）
  const ordered = [...sessions.filter((s) => s.id === me.id), ...sessions.filter((s) => s.id !== me.id)];

  return (
    <AdminPage>
      <PageHeader
        title="我的账号"
        description="修改自己的密码，查看并管理当前账号的登录设备。"
      />
      <dl className="grid gap-x-8 gap-y-4 border-b border-line py-5 sm:grid-cols-3">
        {[
          { label: "用户名", value: me.account.username },
          { label: "显示名称", value: me.account.displayName },
          { label: "角色", value: me.account.role === "admin" ? "管理员" : "编辑" },
        ].map((row) => <div key={row.label} className="min-w-0"><dt className="text-[0.75rem] text-muted">{row.label}</dt><dd className="mt-1 break-words text-[0.9375rem] text-ink">{row.value}</dd></div>)}
      </dl>
      <ChangePasswordForm />
      <h2 className="pt-7 pb-2 text-[0.9375rem] font-semibold">登录设备</h2>
      <DeviceList
        devices={ordered.map((s) => ({
          id: s.id,
          device: s.device,
          ip: s.ip,
          createdAt: s.createdAt,
          createdText: formatDateTime(s.createdAt),
          lastSeenAt: s.lastSeenAt,
          lastSeenText: formatDateTime(s.lastSeenAt),
          current: s.id === me.id,
        }))}
      />
    </AdminPage>
  );
}
