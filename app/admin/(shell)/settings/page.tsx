import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { AdminPage, PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "设置" };

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <AdminPage>
      <PageHeader title="设置" description="站点信息、首页文案和评论规则。保存后前台立即生效。" />
      <SettingsForm
        initial={{
          title: s.title,
          homepage: s.homepage,
          tagline: s.tagline,
          description: s.description,
          author: s.author,
          email: s.email ?? "",
          github: s.github ?? "",
          x: s.x ?? "",
          aboutMarkdown: s.aboutMarkdown,
          commentsAutoApprove: s.commentsAutoApprove,
        }}
      />
    </AdminPage>
  );
}
