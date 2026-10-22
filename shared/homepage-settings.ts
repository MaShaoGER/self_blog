export const DEFAULT_HOMEPAGE = {
  establishedPrefix: "EST.",
  establishedYear: "2026",
  categoryLine: "ARCHIVE · NOTES · CODE",
  identityPrefix: "SELF_BLOG",
  latestLabel: "阅读最新",
  archiveLabel: "全部",
  archiveCountUnit: "篇",
  featuredLabel: "FEATURED",
  projectsLabel: "PROJECTS / 项目",
  projectsAllLabel: "全部",
  indexLabel: "INDEX / 目录",
  columnLegend: "NO. · TITLE · DATE · CAT · MIN",
  emptyTitle: "NO RECORDS",
  emptyBody: "还没有发布的文章。第一篇正在写；也可以先订阅 RSS，发布时会收到。",
  statusTitle: "STATUS / CTL-01",
  statusOnline: "SYS.ONLINE",
  statusEntries: "ENTRIES",
  statusArchive: "ARCHIVE",
  statusWords: "WORDS",
  statusUpdated: "UPDATED",
  statusRevision: "REV.02",
  statusScale: "SCALE 1:1",
  statusSerial: "SERIAL",
};

export type HomePageSettings = typeof DEFAULT_HOMEPAGE;
export type HomePageKey = keyof HomePageSettings;

export const HOMEPAGE_GROUPS: { title: string; hint: string; fields: { key: HomePageKey; label: string; optional?: boolean }[] }[] = [
  { title: "首页 · 铭牌", hint: "站点名称、作者和描述沿用上方设置；这里编辑铭牌上的辅助文字。", fields: [
    { key: "establishedPrefix", label: "创立标记" }, { key: "establishedYear", label: "创立年份" },
    { key: "categoryLine", label: "顶部分类说明", optional: true }, { key: "identityPrefix", label: "作者前缀" },
  ] },
  { title: "首页 · 导航与目录", hint: "修改按钮与栏目名称。文章数量、字数和更新时间根据内容自动计算。", fields: [
    { key: "latestLabel", label: "最新文章按钮" }, { key: "archiveLabel", label: "归档入口文字" },
    { key: "archiveCountUnit", label: "文章计数单位" }, { key: "featuredLabel", label: "精选栏目" },
    { key: "projectsLabel", label: "项目栏目" }, { key: "projectsAllLabel", label: "全部项目入口" },
    { key: "indexLabel", label: "文章目录标题" }, { key: "columnLegend", label: "目录列说明", optional: true },
    { key: "emptyTitle", label: "暂无文章标题" }, { key: "emptyBody", label: "暂无文章说明", optional: true },
  ] },
  { title: "首页 · 状态面板", hint: "编辑面板上的文字标签；读数继续由已发布文章生成。每项最多 120 字。", fields: [
    { key: "statusTitle", label: "面板标题" }, { key: "statusOnline", label: "在线状态" },
    { key: "statusEntries", label: "文章数量标签" }, { key: "statusArchive", label: "归档年份标签" },
    { key: "statusWords", label: "总字数标签" }, { key: "statusUpdated", label: "更新时间标签" },
    { key: "statusRevision", label: "版本标记" }, { key: "statusScale", label: "比例标记" },
    { key: "statusSerial", label: "条码标签" },
  ] },
];

export class SettingsValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = "SettingsValidationError";
  }
}

export function validateHomepagePatch(value: unknown): Partial<HomePageSettings> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SettingsValidationError("homepage", "首页设置格式不正确");
  }
  const patch: Partial<HomePageSettings> = {};
  for (const { fields } of HOMEPAGE_GROUPS) for (const { key, label, optional } of fields) {
    if (!Object.hasOwn(value, key)) continue;
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw !== "string") throw new SettingsValidationError(`homepage.${key}`, `${label}必须是文字`);
    const text = raw.trim();
    if (!optional && !text) throw new SettingsValidationError(`homepage.${key}`, `${label}不能为空`);
    if (text.length > 120) throw new SettingsValidationError(`homepage.${key}`, `${label}最多 120 个字符`);
    patch[key] = text;
  }
  return patch;
}
