import { requireAdmin } from "@/lib/auth";
import { countPending } from "@/lib/comments";
import { getSettings } from "@/lib/settings";
import { AdminNav } from "@/components/admin/admin-nav";
import { logout } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [pending, settings] = await Promise.all([countPending(), getSettings()]);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[13rem_minmax(0,1fr)]">
      <AdminNav pending={pending} siteTitle={settings.title} logout={logout} />
      <main id="main" className="min-w-0 pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
    </div>
  );
}
