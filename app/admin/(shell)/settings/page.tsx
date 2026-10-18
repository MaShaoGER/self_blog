import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { AdminPage, PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "设置" };

export default async function SettingsPage() {
  const s = await getSettings();
  return (
    <AdminPage>
      <PageHeader title="设置" description="站点名称、作者信息和评论规则。保存后前台立即生效。" />
      <SettingsForm
        initial={{
          title: s.title,
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
