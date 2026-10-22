import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { listProjectsForAdmin, ProjectsDataError } from "@/lib/projects";
import { AdminPage, PageHeader } from "@/components/admin/page-header";
import { ProjectManager } from "@/components/admin/project-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "项目展示" };

export default async function ProjectsPage() {
  await requireAdmin();
  let projects;
  try { projects = await listProjectsForAdmin(); }
  catch (error) {
    if (!(error instanceof ProjectsDataError)) throw error;
    return <AdminPage><PageHeader title="项目展示" description="维护公开展示的作品与工具。" /><p role="alert" className="border-b border-line py-6 text-sm leading-relaxed text-accent-ink">{error.message}</p></AdminPage>;
  }
  return <AdminPage><PageHeader title="项目展示" description="维护公开展示的作品与工具，保存后立即更新。" /><ProjectManager projects={projects} /></AdminPage>;
}
