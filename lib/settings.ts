import path from "node:path";
import { DATA_DIR } from "./env";
import { readJson, updateJson } from "./store";
import type { SiteSettings } from "./types";
import { DEFAULT_HOMEPAGE, SettingsValidationError, validateHomepagePatch, type HomePageSettings } from "../shared/homepage-settings";
import { DEFAULT_FOOTER, DEFAULT_NAVIGATION, mergeNavigation, validateFooterPatch, validateNavigationPatch, type NavigationPatch, type SiteFooterSettings } from "../shared/site-chrome";

const FILE = path.join(DATA_DIR, "settings.json");

export const DEFAULT_SETTINGS: SiteSettings = {
  homepage: DEFAULT_HOMEPAGE,
  navigation: DEFAULT_NAVIGATION,
  footer: DEFAULT_FOOTER,
  title: "纸上",
  tagline: "写给以后的自己",
  description: "一个人的写作与笔记。",
  author: "作者",
  aboutMarkdown: "这里还没有自我介绍。去后台的「站点设置」写几句吧。",
  commentsAutoApprove: false,
};

export async function getSettings(): Promise<SiteSettings> {
  return mergeSettings(await readJson<SettingsPatch>(FILE, {}));
}

export type SettingsPatch = Omit<Partial<SiteSettings>, "homepage" | "navigation" | "footer"> & { homepage?: Partial<HomePageSettings>; navigation?: NavigationPatch; footer?: Partial<SiteFooterSettings> };

function mergeSettings(current: SettingsPatch, patch: SettingsPatch = {}): SiteSettings {
  return { ...DEFAULT_SETTINGS, ...current, ...patch, homepage: { ...DEFAULT_HOMEPAGE, ...current.homepage, ...patch.homepage }, navigation: mergeNavigation(current.navigation, patch.navigation), footer: { ...DEFAULT_FOOTER, ...current.footer, ...patch.footer } };
}

const TEXT_LIMITS = { title: 60, tagline: 120, description: 300, author: 60, avatar: 2000, email: 120, github: 200, x: 200, aboutMarkdown: 20000 } as const;

export async function saveSettings(patch: SettingsPatch): Promise<SiteSettings> {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new SettingsValidationError("", "设置格式不正确");
  const checked = { ...patch };
  for (const [key, max] of Object.entries(TEXT_LIMITS) as [keyof typeof TEXT_LIMITS, number][]) {
    if (!Object.hasOwn(patch, key)) continue;
    const raw = patch[key];
    if (raw === undefined && ["avatar", "email", "github", "x"].includes(key)) continue;
    if (typeof raw !== "string") throw new SettingsValidationError(key, "内容必须是文字");
    const text = raw.trim();
    if ((key === "title" || key === "author") && !text) throw new SettingsValidationError(key, "此项不能为空");
    if (text.length > max) throw new SettingsValidationError(key, `内容最多 ${max} 个字符`);
    checked[key] = text;
  }
  if (Object.hasOwn(patch, "commentsAutoApprove") && typeof patch.commentsAutoApprove !== "boolean") throw new SettingsValidationError("commentsAutoApprove", "评论设置格式不正确");
  if (Object.hasOwn(patch, "homepage")) checked.homepage = validateHomepagePatch(patch.homepage);
  if (Object.hasOwn(patch, "navigation")) checked.navigation = validateNavigationPatch(patch.navigation);
  if (Object.hasOwn(patch, "footer")) checked.footer = validateFooterPatch(patch.footer);
  return updateJson<SettingsPatch, SiteSettings>(FILE, {}, (cur) => {
    const value = mergeSettings(cur, checked);
    return { value, result: value };
  });
}
