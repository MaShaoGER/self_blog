import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listResourcesForAdmin, ResourcesDataError } from "@/lib/resources";
import type { ResourceRecord } from "@/shared/resource-types";
import { AdminPage, PageHeader } from "@/components/admin/page-header";
import { ResourceManager } from "@/components/admin/resource-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "资源库" };

export default async function ResourcesAdminPage() {
  await requireSession();
  let resources: ResourceRecord[] = [];
  try {
    resources = await listResourcesForAdmin();
  } catch (error) {
    if (!(error instanceof ResourcesDataError)) throw error;
    return (
      <AdminPage>
        <PageHeader title="资源库" description="维护资源索引：文件夹、视频、模型、图片和文件。" />
        <p role="alert" className="border-b border-line py-6 text-sm leading-relaxed text-accent-ink">
          {error.message}
        </p>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <PageHeader
        title="资源库"
        description="维护资源索引：文件夹、视频、模型、图片和文件。私有条目仅登录后台可访问。"
        actions={
          <>
            <Link href="/resources" className="btn btn-secondary h-11!">
              查看前台资源库
            </Link>
            <Link href="/admin/posts/new" className="btn btn-ghost h-11!">
              写文章插入视频
            </Link>
          </>
        }
      />
      <ResourceManager resources={resources} />
    </AdminPage>
  );
}
