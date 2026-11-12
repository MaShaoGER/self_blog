"use client";

import { useActionState, useEffect, useId, useState } from "react";
import Link from "next/link";
import type {
  ResourceActionState,
  ResourceKind,
  ResourceRecord,
  ResourceVisibility,
} from "@/shared/resource-types";
import { ConfirmButton } from "@/components/admin/confirm-button";
import {
  createResourceAction,
  deleteResourceAction,
  updateResourceAction,
} from "@/app/admin/(shell)/resources/actions";

const KIND_LABELS: Record<ResourceKind, string> = {
  folder: "文件夹",
  video: "视频",
  model: "模型",
  image: "图片",
  file: "文件",
};

const initialState: ResourceActionState = { status: "idle" };
const labelClass = "block text-sm font-medium text-ink-soft";
const fieldClass = "field mt-1.5 h-11 min-w-0 w-full";

const PRIVATE_WARNING =
  "仅已登录的后台账号可访问；公开条目链接会提供给访客，过期链接需手动更新";

type FormValues = {
  name: string;
  description: string;
  kind: ResourceKind;
  parentId: string;
  visibility: ResourceVisibility;
  listed: boolean;
  size: string;
  sourceType: "direct" | "embed";
  url: string;
  format: string;
  expiresAt: string;
  provider: "youtube" | "bilibili";
  videoId: string;
};

function initialValues(record?: ResourceRecord): FormValues {
  const source = record?.source;
  const direct = source?.type === "direct" ? source : null;
  const embed = source?.type === "embed" ? source : null;
  return {
    name: record?.name ?? "",
    description: record?.description ?? "",
    kind: record?.kind ?? "file",
    parentId: record?.parentId ?? "",
    visibility: record?.visibility ?? "public",
    listed: record?.listed !== false,
    size: typeof record?.size === "number" ? String(record.size) : "",
    sourceType: embed ? "embed" : "direct",
    url: direct?.url ?? "",
    format: record?.kind === "video" ? (direct?.format ?? "") : "",
    expiresAt: direct?.expiresAt ?? "",
    provider: embed?.provider ?? "youtube",
    videoId: embed?.videoId ?? "",
  };
}

type FolderOption = { id: string; name: string; depth: number };

function folderOptions(resources: ResourceRecord[], excludeId?: string): FolderOption[] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const children = new Map<string, ResourceRecord[]>();
  for (const resource of resources) {
    if (!resource.parentId) continue;
    const siblings = children.get(resource.parentId) ?? [];
    siblings.push(resource);
    children.set(resource.parentId, siblings);
  }

  const excluded = new Set<string>();
  if (excludeId) {
    const stack = [excludeId];
    while (stack.length) {
      const id = stack.pop();
      if (!id || excluded.has(id)) continue;
      excluded.add(id);
      for (const child of children.get(id) ?? []) stack.push(child.id);
    }
  }

  function depthOf(resource: ResourceRecord): number {
    let depth = 0;
    let parentId = resource.parentId;
    const seen = new Set<string>();
    while (parentId && depth < 32 && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      depth += 1;
      parentId = parent.parentId;
    }
    return depth;
  }

  return resources
    .filter((resource) => resource.kind === "folder" && !excluded.has(resource.id))
    .map((resource) => ({ id: resource.id, name: resource.name, depth: depthOf(resource) }));
}

function parentName(resources: ResourceRecord[], id: string | null): string {
  if (!id) return "根目录";
  return resources.find((resource) => resource.id === id)?.name ?? "上级文件夹";
}

function patternDepth(resources: ResourceRecord[], id: string | null): number {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  let depth = 0;
  let parentId = id;
  const seen = new Set<string>();
  while (parentId && depth < 32 && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
}

function ResourceForm({ record, resources }: { record?: ResourceRecord; resources: ResourceRecord[] }) {
  const [state, action, pending] = useActionState(
    record ? updateResourceAction : createResourceAction,
    initialState,
  );
  const [values, setValues] = useState<FormValues>(() => initialValues(record));
  const uid = useId();
  const feedbackId = `${uid}-feedback`;
  const folders = folderOptions(resources, record?.id);

  useEffect(() => {
    if (!record && state.status === "success") setValues(initialValues());
  }, [record, state]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const invalid = (field: string) => {
    if (state.status !== "error") return undefined;
    const sourceFields = field === "url" || field === "format" || field === "expiresAt" || field === "videoId" || field === "provider";
    return state.field === field || (state.field === "source" && sourceFields) ? true : undefined;
  };
  const describedBy = (key: string, hint?: string) =>
    [hint ? `${uid}-${key}-hint` : "", invalid(key) ? feedbackId : ""].filter(Boolean).join(" ") || undefined;

  const isFolder = values.kind === "folder";
  const isVideo = values.kind === "video";

  return (
    <form action={action} aria-label={record ? `编辑资源 ${record.name}` : "添加资源"} className="space-y-4">
      {record ? <input type="hidden" name="id" value={record.id} /> : null}
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2 disabled:opacity-60">
        <div className="min-w-0">
          <label htmlFor={`${uid}-name`} className={labelClass}>
            名称
          </label>
          <input
            id={`${uid}-name`}
            name="name"
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            maxLength={120}
            required
            aria-invalid={invalid("name")}
            aria-describedby={describedBy("name")}
            className={fieldClass}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${uid}-kind`} className={labelClass}>
            条目类型
          </label>
          <select
            id={`${uid}-kind`}
            name="kind"
            value={values.kind}
            onChange={(event) => set("kind", event.target.value as ResourceKind)}
            aria-invalid={invalid("kind")}
            aria-describedby={describedBy("kind")}
            className={fieldClass}
          >
            <option value="folder">文件夹</option>
            <option value="video">视频</option>
            <option value="model">三维模型</option>
            <option value="image">图片</option>
            <option value="file">文件</option>
          </select>
        </div>

        <div className="min-w-0 sm:col-span-2">
          <label htmlFor={`${uid}-description`} className={labelClass}>
            简介（可选）
          </label>
          <textarea
            id={`${uid}-description`}
            name="description"
            rows={3}
            maxLength={2000}
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            aria-invalid={invalid("description")}
            aria-describedby={describedBy("description")}
            className="field mt-1.5 min-h-24 w-full resize-y py-3"
          />
        </div>

        <div className="min-w-0">
          <label htmlFor={`${uid}-parent`} className={labelClass}>
            上级文件夹
          </label>
          <select
            id={`${uid}-parent`}
            name="parentId"
            value={values.parentId}
            onChange={(event) => set("parentId", event.target.value)}
            aria-invalid={invalid("parentId")}
            aria-describedby={describedBy("parentId")}
            className={fieldClass}
          >
            <option value="">根目录（不放入文件夹）</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {`${"— ".repeat(folder.depth)}${folder.name}`}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="min-w-0">
          <legend className={labelClass}>可见性</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={values.visibility === "public"}
                onChange={() => set("visibility", "public")}
                className="size-4 accent-accent"
              />
              公开
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={values.visibility === "private"}
                onChange={() => set("visibility", "private")}
                className="size-4 accent-accent"
              />
              私有
            </label>
          </div>
        </fieldset>

        <div className="sm:col-span-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" name="listed" value="true" checked={values.listed} onChange={event => set("listed", event.target.checked)} className="size-4 accent-accent" />
            出现在公开资源目录
          </label>
          <p className="mt-1 text-xs leading-relaxed text-muted">关闭后仍可通过链接访问；敏感内容请设为私有。编辑器插入的视频默认不列目录。</p>
        </div>

        {isFolder ? null : (
          <>
            <div className="min-w-0">
              <label htmlFor={`${uid}-size`} className={labelClass}>
                文件大小（可选）
              </label>
              <input
                id={`${uid}-size`}
                name="size"
                value={values.size}
                onChange={(event) => set("size", event.target.value)}
                inputMode="numeric"
                maxLength={18}
                aria-invalid={invalid("size")}
                aria-describedby={describedBy("size", `${uid}-size-hint`)}
                className={fieldClass}
              />
              <p id={`${uid}-size-hint`} className="mt-1.5 text-xs leading-relaxed text-muted">
                以字节为单位，仅用于列表展示；不知道可以留空。
              </p>
            </div>

            <div className="min-w-0">
              <span className={labelClass}>来源</span>
              {isVideo ? (
                <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="radio"
                      name="sourceType"
                      value="direct"
                      checked={values.sourceType === "direct"}
                      onChange={() => set("sourceType", "direct")}
                      className="size-4 accent-accent"
                    />
                    直链播放
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="radio"
                      name="sourceType"
                      value="embed"
                      checked={values.sourceType === "embed"}
                      onChange={() => set("sourceType", "embed")}
                      className="size-4 accent-accent"
                    />
                    平台嵌入
                  </label>
                </div>
              ) : (
                <>
                  <input type="hidden" name="sourceType" value="direct" />
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">
                    {values.kind === "model"
                      ? "模型使用 HTTPS 直链，格式固定为 GLB。"
                      : "图片与文件使用 HTTPS 直链。"}
                  </p>
                </>
              )}
            </div>

            {values.sourceType === "direct" || !isVideo ? (
              <>
                <div className="min-w-0 sm:col-span-2">
                  <label htmlFor={`${uid}-url`} className={labelClass}>
                    资源地址
                  </label>
                  <input
                    id={`${uid}-url`}
                    name="url"
                    value={values.url}
                    onChange={(event) => set("url", event.target.value)}
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={8192}
                    aria-invalid={invalid("url")}
                    aria-describedby={describedBy("url", `${uid}-url-hint`)}
                    className={fieldClass}
                  />
                  <p id={`${uid}-url-hint`} className="mt-1.5 text-xs leading-relaxed text-muted">
                    HTTPS 直链，或 /uploads/ 开头的本站上传地址。
                  </p>
                </div>
                {isVideo ? (
                  <div className="min-w-0">
                    <label htmlFor={`${uid}-format`} className={labelClass}>
                      视频格式（可选）
                    </label>
                    <select
                      id={`${uid}-format`}
                      name="format"
                      value={values.format}
                      onChange={(event) => set("format", event.target.value)}
                      aria-invalid={invalid("format")}
                      className={fieldClass}
                    >
                      <option value="">按地址自动判断</option>
                      <option value="mp4">MP4</option>
                      <option value="webm">WebM</option>
                      <option value="hls">HLS（m3u8）</option>
                    </select>
                  </div>
                ) : null}
                <div className="min-w-0">
                  <label htmlFor={`${uid}-expiresAt`} className={labelClass}>
                    链接过期时间（可选）
                  </label>
                  <input
                    id={`${uid}-expiresAt`}
                    name="expiresAt"
                    value={values.expiresAt}
                    onChange={(event) => set("expiresAt", event.target.value)}
                    placeholder="2030-01-01T00:00:00+08:00"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={64}
                    aria-invalid={invalid("expiresAt")}
                    aria-describedby={describedBy("expiresAt", `${uid}-expiresAt-hint`)}
                    className={fieldClass}
                  />
                  <p id={`${uid}-expiresAt-hint`} className="mt-1.5 text-xs leading-relaxed text-muted">
                    ISO 8601 时间，含时区；留空表示不过期。
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <label htmlFor={`${uid}-provider`} className={labelClass}>
                    嵌入平台
                  </label>
                  <select
                    id={`${uid}-provider`}
                    name="provider"
                    value={values.provider}
                    onChange={(event) => set("provider", event.target.value as FormValues["provider"])}
                    aria-invalid={invalid("provider")}
                    className={fieldClass}
                  >
                    <option value="youtube">YouTube</option>
                    <option value="bilibili">哔哩哔哩</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label htmlFor={`${uid}-videoId`} className={labelClass}>
                    视频 ID
                  </label>
                  <input
                    id={`${uid}-videoId`}
                    name="videoId"
                    value={values.videoId}
                    onChange={(event) => set("videoId", event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={128}
                    aria-invalid={invalid("videoId")}
                    aria-describedby={describedBy("videoId", `${uid}-videoId-hint`)}
                    className={fieldClass}
                  />
                  <p id={`${uid}-videoId-hint`} className="mt-1.5 text-xs leading-relaxed text-muted">
                    YouTube 视频 ID，或哔哩哔哩 BV / av 号。
                  </p>
                </div>
              </>
            )}
          </>
        )}

        <p className="border-l-2 border-accent pl-3 text-xs leading-relaxed text-muted sm:col-span-2">
          {PRIVATE_WARNING}
        </p>
      </fieldset>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          id={feedbackId}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          aria-atomic="true"
          className={`min-w-0 text-sm leading-relaxed ${
            state.status === "error"
              ? "text-accent-ink"
              : state.status === "success"
                ? "text-green"
                : "text-muted"
          }`}
        >
          {pending ? "正在保存…" : state.message}
        </p>
        <button type="submit" disabled={pending} className="btn btn-primary h-11! w-full shrink-0 sm:w-auto">
          {pending ? "保存中…" : record ? "保存资源" : "添加资源"}
        </button>
      </div>
    </form>
  );
}

function ResourceRow({ record, resources, index }: { record: ResourceRecord; resources: ResourceRecord[]; index: number }) {
  const uid = useId();
  const [deleted, setDeleted] = useState(false);
  const depth = patternDepth(resources, record.parentId);
  if (deleted) {
    return (
      <p role="status" className="border-b border-line py-4 text-sm text-green">
        资源「{record.name}」已删除
      </p>
    );
  }
  return (
    <article
      aria-labelledby={`${uid}-title`}
      className="min-w-0 border-b border-line py-5"
      style={depth ? { paddingLeft: `${Math.min(depth, 8) * 12}px` } : undefined}
    >
      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-1 shrink-0 font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <h3 id={`${uid}-title`} className="break-words text-base font-semibold text-ink">
              {record.name}
            </h3>
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <span>{KIND_LABELS[record.kind]}</span>
              <span>{record.visibility === "private" ? "私有" : "公开"}</span>
              {record.listed === false ? <span>未列目录</span> : null}
              <span>上级：{parentName(resources, record.parentId)}</span>
              {typeof record.size === "number" ? <span className="font-mono">{record.size} B</span> : null}
            </p>
          </div>
        </div>
        <ConfirmButton
          action={() => deleteResourceAction(record.id)}
          title={`删除资源「${record.name}」？`}
          description="只删除这条索引记录及其下级索引，不会删除云端或外部的实际文件。此操作无法撤销。"
          confirmLabel="确认删除"
          className="btn btn-ghost h-11! shrink-0 text-accent-ink!"
          aria-label={`删除资源 ${record.name}`}
          onDone={(error) => {
            if (!error) setDeleted(true);
          }}
        >
          删除
        </ConfirmButton>
      </div>
      <details className="min-w-0">
        <summary className="w-fit cursor-pointer py-1 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          编辑这条资源
        </summary>
        <div className="pt-4">
          <ResourceForm record={record} resources={resources} />
        </div>
      </details>
    </article>
  );
}

export function ResourceManager({ resources }: { resources: ResourceRecord[] }) {
  return (
    <div className="min-w-0">
      <details
        className="border-b border-line py-5"
        open={resources.length === 0 ? true : undefined}
      >
        <summary className="w-fit cursor-pointer py-1 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          添加资源
        </summary>
        <div className="pt-5">
          <ResourceForm resources={resources} />
        </div>
      </details>

      <section aria-labelledby="resources-list-title" className="pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
          <h2 id="resources-list-title" className="text-base font-semibold text-ink">
            资源索引 <span className="ml-1 font-mono text-sm font-normal text-muted">{resources.length}</span>
          </h2>
          <p className="text-xs text-muted">
            文件夹在前，其余按名称排列；缩进表示上下级关系。
          </p>
        </div>
        {resources.length ? (
          resources.map((resource, index) => (
            <ResourceRow key={resource.id} record={resource} resources={resources} index={index} />
          ))
        ) : (
          <p className="py-8 text-sm leading-relaxed text-muted">
            还没有资源。先添加一个文件夹或条目，再在名称旁补齐简介和来源。
          </p>
        )}
      </section>

      <p className="pt-6 text-xs leading-relaxed text-muted">
        前台入口：
        <Link href="/resources" className="ml-1 inline-flex min-h-11 items-center underline underline-offset-4 hover:text-accent-ink">
          资源库
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href="/admin/posts/new" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-accent-ink">
          文章编辑器
        </Link>
      </p>
    </div>
  );
}
