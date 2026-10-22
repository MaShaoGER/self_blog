import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { listAccounts } from "@/lib/accounts";
import { AdminPage, PageHeader } from "@/components/admin/page-header";
import { AccountManager } from "@/components/admin/account-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "账号管理" };

export default async function AccountsPage() {
  const session = await requireAdmin();
  const accounts = await listAccounts();
  return (
    <AdminPage>
      <PageHeader title="账号管理" description="为协作者分配独立账号，按职责开放后台权限。" />
      <AccountManager accounts={accounts} currentAccountId={session.accountId} />
    </AdminPage>
  );
}
