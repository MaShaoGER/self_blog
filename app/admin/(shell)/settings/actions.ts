"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { saveSettings, type SettingsPatch } from "@/lib/settings";
import { HOMEPAGE_GROUPS, SettingsValidationError } from "@/shared/homepage-settings";
import { NAV_DESTINATIONS, FOOTER_FIELDS } from "@/shared/site-chrome";
import type { SiteSettings } from "@/lib/types";

export type SettingsState =
  | { status: "idle" }
  | { status: "saved"; savedAt: string }
  | { status: "error"; message: string; field?: keyof SiteSettings | `homepage.${string}` | `navigation.${string}` | `footer.${string}` };

const LIMITS = {
  title: 60,
  tagline: 120,
  description: 300,
  author: 60,
  email: 120,
  github: 200,
  x: 200,
  aboutMarkdown: 20000,
} as const;

function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function saveSettingsAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  await assertAdmin();

  const values = {
    title: str(form, "title"),
    tagline: str(form, "tagline"),
    description: str(form, "description"),
    author: str(form, "author"),
    email: str(form, "email"),
    github: str(form, "github"),
    x: str(form, "x"),
    aboutMarkdown: str(form, "aboutMarkdown"),
  };

  if (!values.title) return { status: "error", field: "title", message: "站点名称不能为空" };
  if (!values.author) return { status: "error", field: "author", message: "作者名不能为空" };
  for (const [k, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
    if (values[k].length > max) return { status: "error", field: k, message: `内容太长了，最多 ${max} 个字符` };
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return { status: "error", field: "email", message: "邮箱格式不正确" };
  }

  const patch: SettingsPatch = {
    ...values,
    // 可选字段留空时存 undefined，前台据此隐藏对应链接
    email: values.email || undefined,
    github: values.github || undefined,
    x: values.x || undefined,
    commentsAutoApprove: form.get("commentsAutoApprove") === "on",
    homepage: Object.fromEntries(HOMEPAGE_GROUPS.flatMap(({ fields }) => fields.map(({ key }) => [`${key}`, form.get(`homepage.${key}`)]))),
    navigation: Object.fromEntries(NAV_DESTINATIONS.map(({ key }) => [key, { label: form.get(`navigation.${key}.label`), en: form.get(`navigation.${key}.en`) }])) as SettingsPatch["navigation"],
    footer: Object.fromEntries(FOOTER_FIELDS.map(({ key }) => [key, form.get(`footer.${key}`)])) as SettingsPatch["footer"],
  };

  try {
    await saveSettings(patch);
  } catch (err) {
    if (err instanceof SettingsValidationError) return { status: "error", field: err.field as Extract<SettingsState, { status: "error" }>["field"], message: err.message };
    console.error("save settings failed", err);
    return { status: "error", message: "保存失败，请稍后重试" };
  }
  revalidatePath("/", "layout");
  return { status: "saved", savedAt: new Date().toISOString() };
}
