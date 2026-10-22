import { SettingsValidationError } from "./homepage-settings";

export const NAV_DESTINATIONS = [
  { key: "home", href: "/", title: "文章", wideOnly: false },
  { key: "archive", href: "/archive", title: "归档", wideOnly: false },
  { key: "series", href: "/series", title: "系列", wideOnly: true },
  { key: "projects", href: "/projects", title: "项目", wideOnly: true },
  { key: "tags", href: "/tags", title: "标签", wideOnly: false },
  { key: "about", href: "/about", title: "关于", wideOnly: false },
  { key: "search", href: "/search", title: "搜索", wideOnly: false },
] as const;

export type NavigationKey = typeof NAV_DESTINATIONS[number]["key"];
export type NavigationLabel = { label: string; en: string };
export type SiteNavigation = Record<NavigationKey, NavigationLabel>;
export type NavigationPatch = Partial<Record<NavigationKey, Partial<NavigationLabel>>>;

export const DEFAULT_NAVIGATION: SiteNavigation = {
  home: { label: "文章", en: "ARCHIVE" }, archive: { label: "归档", en: "INDEX" },
  series: { label: "系列", en: "SERIES" }, projects: { label: "项目", en: "PROJECTS" },
  tags: { label: "标签", en: "TAGS" }, about: { label: "关于", en: "ABOUT" }, search: { label: "搜索", en: "SEARCH" },
};

export const DEFAULT_FOOTER = {
  brandPrefix: "SELF_BLOG", buildLabel: "BUILD", buildValue: "NEXT 16 / REACT 19",
  contentLabel: "CONTENT", contentValue: "MARKDOWN FILES", rssLabel: "RSS", rssValue: "FEED.XML",
  revisionLabel: "REV", description: "", subscriptionLabel: "RSS", manageLabel: "管理",
};
export type SiteFooterSettings = typeof DEFAULT_FOOTER;
export type FooterKey = keyof SiteFooterSettings;
export const FOOTER_FIELDS: { key: FooterKey; label: string; max: number; optional?: boolean }[] = [
  { key: "brandPrefix", label: "品牌前缀", max: 32 },
  { key: "buildLabel", label: "搭建规格标签", max: 16 }, { key: "buildValue", label: "搭建规格内容", max: 100 },
  { key: "contentLabel", label: "内容规格标签", max: 16 }, { key: "contentValue", label: "内容规格内容", max: 100 },
  { key: "rssLabel", label: "订阅规格标签", max: 16 }, { key: "rssValue", label: "订阅规格内容", max: 100 },
  { key: "revisionLabel", label: "版权年份标签", max: 16 }, { key: "description", label: "简短说明", max: 100, optional: true },
  { key: "subscriptionLabel", label: "订阅入口文字", max: 16 }, { key: "manageLabel", label: "管理入口文字", max: 16 },
];

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SettingsValidationError(field, "设置格式不正确");
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max: number, optional = false): string {
  if (typeof value !== "string") throw new SettingsValidationError(field, "内容必须是文字");
  const trimmed = value.trim();
  if (!optional && !trimmed) throw new SettingsValidationError(field, "此项不能为空");
  if (trimmed.length > max) throw new SettingsValidationError(field, `内容最多 ${max} 个字符`);
  return trimmed;
}

export function validateNavigationPatch(value: unknown): NavigationPatch {
  const input = record(value, "navigation");
  const patch: NavigationPatch = {};
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(DEFAULT_NAVIGATION, key)) throw new SettingsValidationError("navigation", "导航入口不正确");
    const item = record(input[key], `navigation.${key}`);
    const label: Partial<NavigationLabel> = {};
    for (const part of Object.keys(item)) {
      if (part !== "label" && part !== "en") throw new SettingsValidationError(`navigation.${key}`, "只支持修改导航文字");
      label[part] = text(item[part], `navigation.${key}.${part}`, part === "label" ? 8 : 16, part === "en");
    }
    patch[key as NavigationKey] = label;
  }
  return patch;
}

export function validateFooterPatch(value: unknown): Partial<SiteFooterSettings> {
  const input = record(value, "footer");
  const patch: Partial<SiteFooterSettings> = {};
  for (const key of Object.keys(input)) if (!Object.hasOwn(DEFAULT_FOOTER, key)) throw new SettingsValidationError("footer", "页脚字段不正确");
  for (const { key, max, optional } of FOOTER_FIELDS) if (Object.hasOwn(input, key)) patch[key] = text(input[key], `footer.${key}`, max, optional);
  return patch;
}

export function mergeNavigation(current?: NavigationPatch, patch?: NavigationPatch): SiteNavigation {
  return Object.fromEntries(NAV_DESTINATIONS.map(({ key }) => [key, { ...DEFAULT_NAVIGATION[key], ...current?.[key], ...patch?.[key] }])) as SiteNavigation;
}
