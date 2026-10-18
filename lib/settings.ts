import path from "node:path";
import { DATA_DIR } from "./env";
import { readJson, updateJson } from "./store";
import type { SiteSettings } from "./types";

const FILE = path.join(DATA_DIR, "settings.json");

export const DEFAULT_SETTINGS: SiteSettings = {
  title: "纸上",
  tagline: "写给以后的自己",
  description: "一个人的写作与笔记。",
  author: "作者",
  aboutMarkdown: "这里还没有自我介绍。去后台的「站点设置」写几句吧。",
  commentsAutoApprove: false,
};

export async function getSettings(): Promise<SiteSettings> {
  return { ...DEFAULT_SETTINGS, ...(await readJson<Partial<SiteSettings>>(FILE, {})) };
}

export async function saveSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  return updateJson<Partial<SiteSettings>, SiteSettings>(FILE, {}, (cur) => {
    const value = { ...DEFAULT_SETTINGS, ...cur, ...patch };
    return { value, result: value };
  });
}
