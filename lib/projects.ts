import path from "node:path";
import { DATA_DIR } from "./env";
import { readJson } from "./store";
import type { Project } from "./types";

// Server-only：直接读文件系统，不要在客户端组件里引用。

const FILE = path.join(DATA_DIR, "projects.json");
const EMPTY: Project[] = [];

const STATUSES = ["活跃", "归档", "进行中"] as const;

function text(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

/** 只接受 http(s) 外链，避免把 JSON 里写错的地址整行渲染成坏链接。 */
function externalUrl(v: unknown): string | undefined {
  const url = text(v);
  return /^https?:\/\//i.test(url) ? url : undefined;
}

/** 逐字段收口：一条数据写坏了只丢这一条，不影响整页。 */
function toProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const title = text(r.title);
  if (!title) return null;

  return {
    title,
    description: text(r.description),
    year: text(r.year),
    tags: Array.isArray(r.tags) ? r.tags.map(text).filter(Boolean) : [],
    href: externalUrl(r.href),
    demo: externalUrl(r.demo),
    status: STATUSES.find((s) => s === r.status),
    featured: r.featured === true,
  };
}

/**
 * 项目索引。文件缺失、JSON 损坏或条目不合规时一律退化成空数组，
 * 页面按空态渲染，不因一份数据文件让整站报错。
 * 排序：年份从新到旧，同年按标题排（页面文案按此说明，改排序须同步改页头说明）。
 */
export async function readProjects(): Promise<Project[]> {
  let raw: unknown;
  try {
    raw = await readJson<unknown>(FILE, EMPTY);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .map(toProject)
    .filter((p): p is Project => p !== null)
    .sort((a, b) => b.year.localeCompare(a.year) || a.title.localeCompare(b.title));
}
