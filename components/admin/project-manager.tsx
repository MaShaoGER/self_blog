"use client";

import { useActionState, useId, useState } from "react";
import type { Project } from "@/lib/types";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { createProjectAction, updateProjectAction, deleteProjectAction, type ProjectActionState } from "@/app/admin/(shell)/projects/actions";

type EditableProject = Project & { id: string };
const initialState: ProjectActionState = { status: "idle" };
const labelClass = "block text-sm font-medium text-ink-soft";
const fieldClass = "field mt-1.5 h-11 min-w-0 w-full";

function ProjectForm({ project }: { project?: EditableProject }) {
  const [state, action, pending] = useActionState(project ? updateProjectAction : createProjectAction, initialState);
  const [values, setValues] = useState({ title: project?.title ?? "", description: project?.description ?? "", year: project?.year ?? String(new Date().getFullYear()), tags: project?.tags.join("，") ?? "", href: project?.href ?? "", demo: project?.demo ?? "", status: project?.status ?? "", featured: project?.featured ?? false });
  const uid = useId();
  const statusId = `${uid}-feedback`;
  const set = (key: keyof typeof values, value: string | boolean) => setValues(previous => ({ ...previous, [key]: value }));
  function field(key: "title" | "year" | "tags" | "href" | "demo", label: string, options: { maxLength: number; required?: boolean; type?: string; hint?: string; pattern?: string }) {
    const invalid = state.status === "error" && state.field === key;
    return <div className="min-w-0"><label htmlFor={`${uid}-${key}`} className={labelClass}>{label}</label><input id={`${uid}-${key}`} name={key} value={values[key]} onChange={event => set(key, event.target.value)} maxLength={options.maxLength} required={options.required} type={options.type ?? "text"} pattern={options.pattern} inputMode={key === "year" ? "numeric" : undefined} aria-invalid={invalid || undefined} aria-describedby={[options.hint ? `${uid}-${key}-hint` : "", invalid ? statusId : ""].filter(Boolean).join(" ") || undefined} className={fieldClass} />{options.hint ? <p id={`${uid}-${key}-hint`} className="mt-1.5 text-xs leading-relaxed text-muted">{options.hint}</p> : null}</div>;
  }
  return (
    <form action={action} aria-label={project ? `编辑项目 ${project.title}` : "添加项目"} className="space-y-4">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2 disabled:opacity-60">
        {field("title", "项目名称", { maxLength: 120, required: true })}
        <div className="grid min-w-0 grid-cols-2 gap-3">
          {field("year", "年份", { maxLength: 4, required: true, pattern: "[0-9]{4}" })}
          <div className="min-w-0"><label htmlFor={`${uid}-status`} className={labelClass}>状态</label><select id={`${uid}-status`} name="status" value={values.status} onChange={event => set("status", event.target.value)} aria-invalid={state.field === "status" || undefined} className={fieldClass}><option value="">不显示</option><option>活跃</option><option>进行中</option><option>归档</option></select></div>
        </div>
        <div className="min-w-0 sm:col-span-2"><label htmlFor={`${uid}-description`} className={labelClass}>项目简介</label><textarea id={`${uid}-description`} name="description" rows={3} maxLength={2000} value={values.description} onChange={event => set("description", event.target.value)} aria-invalid={state.field === "description" || undefined} className="field mt-1.5 min-h-24 w-full resize-y py-3" /></div>
        <div className="min-w-0 sm:col-span-2">{field("tags", "标签", { maxLength: 382, hint: "用逗号分隔，最多 12 个，每个不超过 30 个字符。" })}</div>
        {field("href", "项目链接（可选）", { type: "url", maxLength: 2048, hint: "填写完整的 http:// 或 https:// 地址。" })}
        {field("demo", "演示链接（可选）", { type: "url", maxLength: 2048 })}
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft sm:col-span-2"><input type="checkbox" name="featured" checked={values.featured} onChange={event => set("featured", event.target.checked)} className="size-4 accent-accent" />标记为精选项目</label>
      </fieldset>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p id={statusId} role={state.status === "error" ? "alert" : "status"} aria-live="polite" aria-atomic="true" className={`min-w-0 text-sm leading-relaxed ${state.status === "error" ? "text-accent-ink" : state.status === "success" ? "text-green" : "text-muted"}`}>{pending ? "正在保存…" : state.message}</p>
        <button type="submit" disabled={pending} className="btn btn-primary h-11! w-full shrink-0 sm:w-auto">{pending ? "保存中…" : project ? "保存项目" : "添加项目"}</button>
      </div>
    </form>
  );
}

function ProjectRow({ project }: { project: EditableProject }) {
  const uid = useId();
  const [deleted, setDeleted] = useState(false);
  if (deleted) return <p role="status" className="border-b border-line py-4 text-sm text-green">项目「{project.title}」已删除</p>;
  return (
    <article aria-labelledby={`${uid}-title`} className="min-w-0 border-b border-line py-5">
      <div className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1"><h3 id={`${uid}-title`} className="break-words text-base font-semibold text-ink">{project.title}</h3><p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted"><span className="font-mono">{project.year}</span>{project.status ? <span>{project.status}</span> : null}{project.featured ? <span className="text-accent-ink">精选</span> : null}</p></div>
        <ConfirmButton action={() => deleteProjectAction(project.id)} title={`删除项目「${project.title}」？`} description="删除后，项目会从前台移除。此操作无法撤销。" confirmLabel="确认删除项目" className="btn btn-ghost h-11! shrink-0 text-accent-ink!" aria-label={`删除项目 ${project.title}`} onDone={error => { if (!error) setDeleted(true); }}>删除</ConfirmButton>
      </div>
      <ProjectForm project={project} />
    </article>
  );
}

export function ProjectManager({ projects }: { projects: EditableProject[] }) {
  return (
    <div className="min-w-0">
      <details className="border-b border-line py-5" open={projects.length === 0 ? true : undefined}><summary className="w-fit cursor-pointer py-1 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">添加项目</summary><div className="pt-5"><ProjectForm /></div></details>
      <section aria-labelledby="projects-list-title" className="pt-6"><div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4"><h2 id="projects-list-title" className="text-base font-semibold text-ink">现有项目 <span className="ml-1 font-mono text-sm font-normal text-muted">{projects.length}</span></h2><p className="text-xs text-muted">前台按年份从新到旧，同年按名称排序。</p></div>{projects.length ? projects.map(project => <ProjectRow key={project.id} project={project} />) : <p className="py-8 text-sm leading-relaxed text-muted">还没有展示项目。先添加一个作品或工具，介绍它解决的问题。</p>}</section>
    </div>
  );
}
