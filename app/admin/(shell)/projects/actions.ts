"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { createProject, updateProject, deleteProject, ProjectValidationError, ProjectsDataError } from "@/lib/projects";

export type ProjectActionState = { status: "idle" | "success" | "error"; message?: string; field?: string };

function scalar(form: FormData, key: string): string {
  const values = form.getAll(key);
  if (values.length !== 1 || typeof values[0] !== "string") throw new ProjectValidationError(key, "表单内容不完整，请刷新后重试");
  return values[0];
}
function input(form: FormData) {
  const featured = form.getAll("featured");
  if (featured.length > 1 || (featured.length === 1 && featured[0] !== "on")) throw new ProjectValidationError("featured", "精选标记格式不正确");
  return {
    title: scalar(form, "title"), description: scalar(form, "description"), year: scalar(form, "year"),
    tags: scalar(form, "tags").split(/[,，]/).map(tag => tag.trim()).filter(Boolean),
    href: scalar(form, "href"), demo: scalar(form, "demo"), status: scalar(form, "status"), featured: featured.length === 1,
  };
}
function failure(error: unknown): ProjectActionState {
  if (error instanceof ProjectValidationError) return { status: "error", message: error.message, field: error.field };
  if (error instanceof ProjectsDataError) return { status: "error", message: error.message };
  console.error("project mutation failed", error);
  return { status: "error", message: "保存失败，请稍后重试" };
}
function refresh() {
  revalidatePath("/admin/projects");
  revalidatePath("/projects");
  revalidatePath("/");
}
export async function createProjectAction(_previous: ProjectActionState, form: FormData): Promise<ProjectActionState> {
  await assertAdmin();
  try { await createProject(input(form)); }
  catch (error) { return failure(error); }
  refresh();
  return { status: "success", message: "项目已添加，前台展示已更新" };
}
export async function updateProjectAction(_previous: ProjectActionState, form: FormData): Promise<ProjectActionState> {
  await assertAdmin();
  try { await updateProject(scalar(form, "id"), input(form)); }
  catch (error) { return failure(error); }
  refresh();
  return { status: "success", message: "项目已保存，前台展示已更新" };
}
export async function deleteProjectAction(id: string): Promise<void> {
  await assertAdmin();
  try { await deleteProject(id); }
  catch (error) { throw new Error(failure(error).message); }
  refresh();
}
