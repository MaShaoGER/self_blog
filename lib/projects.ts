import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DATA_DIR } from "./env";
import { readJson, updateJson } from "./store";
import type { Project } from "./types";

const FILE = path.join(DATA_DIR, "projects.json");
const STATUSES = ["活跃", "归档", "进行中"] as const;
export type AdminProject = Project & { id: string };

export class ProjectValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "ProjectValidationError";
    this.field = field;
  }
}
export class ProjectsDataError extends Error {
  constructor() {
    super("项目数据无法读取，请检查 projects.json 的格式后重试；现有文件未改动。");
    this.name = "ProjectsDataError";
  }
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}
function externalUrl(v: unknown): string | undefined {
  const value = text(v);
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : undefined;
  } catch { return undefined; }
}
function toProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const title = text(r.title);
  if (!title) return null;
  return {
    title, description: text(r.description), year: text(r.year),
    tags: Array.isArray(r.tags) ? r.tags.map(text).filter(Boolean) : [],
    href: externalUrl(r.href), demo: externalUrl(r.demo),
    status: STATUSES.find(s => s === r.status), featured: r.featured === true,
  };
}
function sort<T extends Project>(items: T[]): T[] {
  return items.sort((a, b) => b.year.localeCompare(a.year) || a.title.localeCompare(b.title));
}

/** Public pages tolerate damaged records; management refuses to rewrite them. */
export async function readProjects(): Promise<Project[]> {
  try {
    const raw = await readJson<unknown>(FILE, []);
    return Array.isArray(raw) ? sort(raw.map(toProject).filter((p): p is Project => p !== null)) : [];
  } catch { return []; }
}

function validate(input: unknown): Project {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ProjectValidationError("title", "项目内容格式不正确");
  const value = input as Record<string, unknown>;
  function scalar(key: string, label: string, max: number, optional = false): string {
    const raw = value[key];
    if (optional && raw === undefined) return "";
    if (typeof raw !== "string") throw new ProjectValidationError(key, `${label}格式不正确`);
    const result = raw.trim();
    if (result.length > max) throw new ProjectValidationError(key, `${label}最多 ${max} 个字符`);
    return result;
  }
  const title = scalar("title", "项目名称", 120);
  if (!title) throw new ProjectValidationError("title", "请填写项目名称");
  const description = scalar("description", "项目简介", 2000);
  const year = scalar("year", "年份", 4);
  if (!/^\d{4}$/.test(year)) throw new ProjectValidationError("year", "年份需为 4 位数字，如 2026");
  if (!Array.isArray(value.tags) || value.tags.length > 12 || value.tags.some(tag => typeof tag !== "string" || !tag.trim() || tag.trim().length > 30)) {
    throw new ProjectValidationError("tags", "最多填写 12 个标签，每个标签为 1–30 个字符");
  }
  const tags = [...new Set((value.tags as string[]).map(tag => tag.trim()))];
  const href = scalar("href", "项目链接", 2048, true);
  const demo = scalar("demo", "演示链接", 2048, true);
  for (const [key, url] of [["href", href], ["demo", demo]]) {
    if (url && !externalUrl(url)) throw new ProjectValidationError(key, "链接需为完整的 http:// 或 https:// 地址");
  }
  const status = scalar("status", "项目状态", 10, true);
  if (status && !STATUSES.includes(status as typeof STATUSES[number])) throw new ProjectValidationError("status", "请选择有效的项目状态");
  if (value.featured !== undefined && typeof value.featured !== "boolean") throw new ProjectValidationError("featured", "精选标记格式不正确");
  return { title, description, year, tags, href: href || undefined, demo: demo || undefined, status: status as Project["status"] || undefined, featured: value.featured === true };
}
function adminProjects(raw: unknown): AdminProject[] {
  if (!Array.isArray(raw)) throw new ProjectsDataError();
  const ids = new Set<string>();
  return raw.map((item, index) => {
    try {
      const value = validate(item);
      const existing = (item as Record<string, unknown>).id;
      if (existing !== undefined && (typeof existing !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(existing))) throw new ProjectsDataError();
      const id = typeof existing === "string" ? existing : `legacy-${createHash("sha256").update(`${index}:${JSON.stringify(item)}`).digest("hex").slice(0, 24)}`;
      if (ids.has(id)) throw new ProjectsDataError();
      ids.add(id);
      return { ...value, id };
    } catch { throw new ProjectsDataError(); }
  });
}
export async function listProjectsForAdmin(): Promise<AdminProject[]> {
  try { return sort(adminProjects(await readJson<unknown>(FILE, []))); }
  catch { throw new ProjectsDataError(); }
}
function mutate<T>(fn: (items: AdminProject[]) => T): Promise<T> {
  return updateJson<unknown, T>(FILE, [], raw => {
    const items = adminProjects(raw);
    const result = fn(items);
    return { value: items, result };
  }).catch(error => {
    if (error instanceof SyntaxError) throw new ProjectsDataError();
    throw error;
  });
}
function find(items: AdminProject[], id: string): number {
  const index = items.findIndex(item => item.id === id);
  if (index < 0) throw new ProjectValidationError("id", "项目已被删除，请刷新列表后重试");
  return index;
}
export async function createProject(input: unknown): Promise<AdminProject> {
  const value = validate(input);
  return mutate(items => { const item = { ...value, id: randomUUID() }; items.push(item); return item; });
}
export async function updateProject(id: string, input: unknown): Promise<AdminProject> {
  const value = validate(input);
  return mutate(items => { const index = find(items, id); items[index] = { ...value, id }; return items[index]; });
}
export async function deleteProject(id: string): Promise<void> {
  return mutate(items => { items.splice(find(items, id), 1); });
}
