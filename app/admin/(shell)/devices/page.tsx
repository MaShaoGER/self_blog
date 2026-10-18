import type { Metadata } from "next";
import { listSessions, requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { AdminPage, PageHeader } from "@/components/admin/page-header";
import { DeviceList } from "@/components/admin/device-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "设备" };

export default async function DevicesPage() {
  const [me, sessions] = await Promise.all([requireAdmin(), listSessions()]);
  // 当前设备置顶，其余按最后活跃倒序（listSessions 已排好）
  const ordered = [...sessions.filter((s) => s.id === me.id), ...sessions.filter((s) => s.id !== me.id)];

  return (
    <AdminPage>
      <PageHeader
        title="设备"
        description="这些设备登录了后台。登录状态 30 天不活跃会自动失效，不认识的设备请立即移除。"
      />
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
