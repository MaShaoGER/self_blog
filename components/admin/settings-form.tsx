"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { saveSettingsAction, type SettingsState } from "@/app/admin/(shell)/settings/actions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { HOMEPAGE_GROUPS, type HomePageSettings } from "@/lib/homepage-settings";

type Values = {
  homepage: HomePageSettings;
  title: string;
  tagline: string;
  description: string;
  author: string;
  email: string;
  github: string;
  x: string;
  aboutMarkdown: string;
  commentsAutoApprove: boolean;
};

type TextKey = Exclude<keyof Values, "commentsAutoApprove" | "homepage">;

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-x-10 gap-y-5 border-b border-line py-7 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div>
        <legend className="text-[0.9375rem] font-semibold text-ink">{title}</legend>
        {hint && <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{hint}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}

export function SettingsForm({ initial }: { initial: Values }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, { status: "idle" });
  // 受控字段：React 19 在 action 提交后会重置非受控表单
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const uid = useId();
  const dirty = (Object.keys(values) as (keyof Values)[]).some((k) => values[k] !== saved[k]);
  const fieldError = state.status === "error" ? state.field : undefined;

  useEffect(() => {
    if (state.status === "saved") setSaved(values);
    // 只在保存结果返回时同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function set<K extends keyof Values>(k: K, v: Values[K]) {
    setValues((cur) => ({ ...cur, [k]: v }));
  }

  function Text({
    name,
    label,
    hint,
    type = "text",
    placeholder,
    required,
    autoComplete,
    inputMode,
  }: {
    name: TextKey;
    label: string;
    hint?: string;
    type?: string;
    placeholder?: string;
    required?: boolean;
    autoComplete?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  }) {
    const id = `${uid}-${name}`;
    const invalid = fieldError === name;
    return (
      <div>
        <label htmlFor={id} className="block text-[0.875rem] font-medium text-ink-soft">
          {label}
          {required && <span className="ml-1 text-muted">（必填）</span>}
        </label>
        <input
          id={id}
          name={name}
          type={type}
          value={values[name]}
          onChange={(e) => set(name, e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete ?? "off"}
          inputMode={inputMode}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={hint || invalid ? `${id}-hint` : undefined}
          className={cn("field mt-1.5 h-11", invalid && "border-accent")}
        />
        {(hint || invalid) && (
          <p id={`${id}-hint`} className={cn("mt-1.5 text-[0.8125rem]", invalid ? "text-accent-ink" : "text-muted")}>
            {invalid && state.status === "error" ? state.message : hint}
          </p>
        )}
      </div>
    );
  }

  const status =
    state.status === "error" && !state.field
      ? { tone: "error" as const, text: state.message }
      : state.status === "error"
        ? { tone: "error" as const, text: "有字段需要修改，见上方提示" }
        : pending
          ? { tone: "muted" as const, text: "正在保存…" }
          : dirty
            ? { tone: "muted" as const, text: "有未保存的修改" }
            : state.status === "saved"
              ? { tone: "ok" as const, text: `已保存，${formatDateTime(state.savedAt)}` }
              : { tone: "muted" as const, text: "" };

  return (
    <form action={formAction} noValidate={false}>
      <Group title="站点" hint="显示在浏览器标签、首页标题和搜索结果里。">
        {Text({ name: "title", label: "站点名称", required: true })}
        {Text({ name: "tagline", label: "一句话介绍", hint: "站点的简短介绍；首页铭牌下方的正文请编辑「站点描述」。" })}
        <div>
          <label htmlFor={`${uid}-description`} className="block text-[0.875rem] font-medium text-ink-soft">
            站点描述
          </label>
          <textarea
            id={`${uid}-description`}
            name="description"
            rows={3}
            maxLength={300}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            aria-describedby={`${uid}-description-hint`}
            aria-invalid={fieldError === "description" || undefined}
            className="field mt-1.5 resize-y leading-relaxed"
          />
          <p id={`${uid}-description-hint`} className={cn("mt-1.5 text-[0.8125rem]", fieldError === "description" ? "text-accent-ink" : "text-muted")}>
            {fieldError === "description" && state.status === "error" ? state.message : "显示在首页铭牌下方，也用于搜索引擎和 RSS，最多 300 字。"}
          </p>
        </div>
      </Group>

      {HOMEPAGE_GROUPS.map((group) => (
        <Group key={group.title} title={group.title} hint={group.hint}>
          <div className="grid gap-5 sm:grid-cols-2">
            {group.fields.map(({ key, label, optional }) => {
              const name = `homepage.${key}` as const;
              const id = `${uid}-${name}`;
              const invalid = fieldError === name;
              return (
                <div key={key} className={key === "emptyBody" || key === "categoryLine" || key === "columnLegend" ? "sm:col-span-2" : undefined}>
                  <label htmlFor={id} className="block text-[0.875rem] font-medium text-ink-soft">{label}</label>
                  <input id={id} name={name} value={values.homepage[key]} maxLength={120} required={!optional}
                    onChange={(e) => setValues((current) => ({ ...current, homepage: { ...current.homepage, [key]: e.target.value } }))}
                    aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
                    className={cn("field mt-1.5 h-11", invalid && "border-accent")} />
                  {invalid && state.status === "error" && <p id={`${id}-error`} className="mt-1.5 text-[0.8125rem] text-accent-ink">{state.message}</p>}
                </div>
              );
            })}
          </div>
        </Group>
      ))}

      <Group title="作者" hint="留空的联系方式不会在前台显示。">
        {Text({ name: "author", label: "作者名", required: true, autoComplete: "name" })}
        {Text({ name: "email", label: "邮箱", type: "email", placeholder: "name@example.com", autoComplete: "email", inputMode: "email" })}
        <div className="grid gap-5 sm:grid-cols-2">
          {Text({ name: "github", label: "GitHub", placeholder: "用户名或主页链接" })}
          {Text({ name: "x", label: "X（Twitter）", placeholder: "用户名或主页链接" })}
        </div>
      </Group>

      <Group title="关于页" hint="支持 Markdown，显示在「关于」页面。">
        <div>
          <label htmlFor={`${uid}-about`} className="sr-only">
            关于页内容
          </label>
          <textarea
            id={`${uid}-about`}
            name="aboutMarkdown"
            rows={12}
            value={values.aboutMarkdown}
            onChange={(e) => set("aboutMarkdown", e.target.value)}
            aria-invalid={fieldError === "aboutMarkdown" || undefined}
            className="field resize-y font-mono text-[0.875rem] leading-[1.7]"
          />
          {fieldError === "aboutMarkdown" && state.status === "error" && (
            <p className="mt-1.5 text-[0.8125rem] text-accent-ink">{state.message}</p>
          )}
        </div>
      </Group>

      <Group title="评论">
        <label htmlFor={`${uid}-auto`} className="flex cursor-pointer items-start justify-between gap-6">
          <span>
            <span className="block text-[0.875rem] font-medium text-ink-soft">新评论自动通过</span>
            <span id={`${uid}-auto-hint`} className="mt-1 block text-[0.8125rem] leading-relaxed text-muted">
              {values.commentsAutoApprove
                ? "访客提交后立即显示在文章下方。"
                : "新评论先进入「待审核」，你通过后才会显示。"}
            </span>
          </span>
          <input
            id={`${uid}-auto`}
            name="commentsAutoApprove"
            type="checkbox"
            role="switch"
            checked={values.commentsAutoApprove}
            onChange={(e) => set("commentsAutoApprove", e.target.checked)}
            aria-describedby={`${uid}-auto-hint`}
            className="admin-switch mt-0.5"
          />
        </label>
      </Group>

      {/* 保存栏：移动端吸附在底部 tab 上方 */}
      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex items-center justify-between gap-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-md md:bottom-0 md:mx-0 md:px-0">
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "min-w-0 text-[0.8125rem]",
            status.tone === "error" ? "text-accent-ink" : status.tone === "ok" ? "text-green" : "text-muted",
          )}
        >
          {status.text}
        </p>
        <button type="submit" disabled={pending} className="btn btn-primary h-11! shrink-0 md:h-10!">
          {pending ? "保存中…" : "保存设置"}
        </button>
      </div>
    </form>
  );
}
