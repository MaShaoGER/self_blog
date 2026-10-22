"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bold,
  Code,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { savePostAction } from "@/app/admin/posts/actions";
import { cn } from "@/lib/cn";
import { formatDateTime, readingStats, slugify } from "@/lib/format";
import type { PostInput, PostStatus } from "@/lib/types";
import { type Edit, fromLocalInput, insertBlock, prefixLines, toLocalInput, wrap } from "./markdown-ops";
import { imageFiles, uploadImage } from "./upload";

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string };

const AUTOSAVE_MS = 4000;
const STATUS_LABEL: Record<PostStatus, string> = { draft: "草稿", published: "已发布", scheduled: "定时发布" };

export function Editor({ initial, originalSlug: initialOriginal }: { initial: PostInput; originalSlug: string | null }) {
  const router = useRouter();
  const [post, setPost] = useState<PostInput>(initial);
  const [originalSlug, setOriginalSlug] = useState(initialOriginal);
  // New posts derive the slug from the title until the author edits it by hand.
  const [slugTouched, setSlugTouched] = useState(initialOriginal !== null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [panelOpen, setPanelOpen] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const savedSnapshot = useRef(JSON.stringify(initial));
  const savingRef = useRef(false);
  const postRef = useRef(post);
  postRef.current = post;

  const dirty = JSON.stringify(post) !== savedSnapshot.current;
  const isLiveEdit = originalSlug !== null && initial.status !== "draft";
  const stats = useMemo(() => readingStats(post.content), [post.content]);

  const update = useCallback((patch: Partial<PostInput>) => {
    setPost((p) => ({ ...p, ...patch }));
  }, []);

  useEffect(() => {
    if (dirty && save.kind !== "saving") setSave({ kind: "dirty" });
  }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback(
    async (overrides?: Partial<PostInput>): Promise<boolean> => {
      if (savingRef.current) return false;
      const current = { ...postRef.current, ...overrides };
      if (!current.title.trim()) {
        setSave({ kind: "error", message: "先写个标题再保存" });
        return false;
      }
      const slug = current.slug || slugify(current.title);
      const payload = { ...current, slug };
      savingRef.current = true;
      setSave({ kind: "saving" });
      const res = await savePostAction(payload, originalSlug);
      savingRef.current = false;
      if (!res.ok) {
        setSave({ kind: "error", message: res.error });
        return false;
      }
      savedSnapshot.current = JSON.stringify({ ...payload, slug: res.slug });
      setPost((p) => ({ ...p, ...overrides, slug: res.slug }));
      setSave({ kind: "saved", at: res.savedAt });
      if (originalSlug !== res.slug) {
        setOriginalSlug(res.slug);
        setSlugTouched(true);
        startTransition(() => router.replace(`/admin/posts/${res.slug}/edit`, { scroll: false }));
      }
      return true;
    },
    [originalSlug, router],
  );

  // Autosave only drafts. Edits to a live post wait for an explicit "更新".
  useEffect(() => {
    if (!dirty || isLiveEdit || post.status !== "draft" || !post.title.trim()) return;
    const t = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [post, dirty, isLiveEdit, persist]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void persist();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persist]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  function applyEdit(edit: Edit) {
    update({ content: edit.value });
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(edit.selStart, edit.selEnd);
    });
  }

  function selection(): [number, number] {
    const el = textRef.current;
    return el ? [el.selectionStart, el.selectionEnd] : [post.content.length, post.content.length];
  }

  const tools: { label: string; icon: typeof Bold; run: () => void; hideOnMobile?: boolean }[] = [
    { label: "二级标题", icon: Heading2, run: () => applyEdit(prefixLines(post.content, ...selection(), "## ")) },
    { label: "加粗", icon: Bold, run: () => applyEdit(wrap(post.content, ...selection(), "**")) },
    { label: "斜体", icon: Italic, run: () => applyEdit(wrap(post.content, ...selection(), "*")) },
    { label: "引用", icon: Quote, run: () => applyEdit(prefixLines(post.content, ...selection(), "> ")) },
    { label: "无序列表", icon: List, run: () => applyEdit(prefixLines(post.content, ...selection(), "- ")) },
    {
      label: "有序列表",
      icon: ListOrdered,
      hideOnMobile: true,
      run: () => applyEdit(prefixLines(post.content, ...selection(), "1. ")),
    },
    {
      label: "链接",
      icon: Link2,
      run: () => {
        const [s, e] = selection();
        applyEdit(wrap(post.content, s, e, "[", "](https://)", "链接文字"));
      },
    },
    {
      label: "代码块",
      icon: Code,
      hideOnMobile: true,
      run: () => {
        const [s, e] = selection();
        const sel = post.content.slice(s, e);
        applyEdit(sel.includes("\n") || !sel ? insertBlock(post.content, s, "```\n" + (sel || "") + "\n```") : wrap(post.content, s, e, "`"));
      },
    },
  ];

  async function insertImages(files: File[]) {
    if (!files.length) return;
    const [start] = selection();
    // Insert placeholders immediately so the author keeps their place while uploading.
    const tokens = files.map((f, i) => `![上传中 ${f.name.replace(/[\[\]]/g, "")} ${Date.now()}-${i}]()`);
    let content = postRef.current.content;
    const block = tokens.join("\n\n");
    const edit = insertBlock(content, start, block);
    content = edit.value;
    applyEdit(edit);
    setUploads((n) => n + files.length);

    await Promise.all(
      files.map(async (file, i) => {
        try {
          const item = await uploadImage(file);
          const alt = file.name.replace(/\.[^.]+$/, "").replace(/[\[\]]/g, "");
          setPost((p) => ({ ...p, content: p.content.replace(tokens[i], `![${alt}](${item.url})`) }));
        } catch (err) {
          setPost((p) => ({ ...p, content: p.content.replace(tokens[i] + "\n\n", "").replace(tokens[i], "") }));
          setNotice(`「${file.name}」${err instanceof Error ? err.message : "上传失败"}`);
        } finally {
          setUploads((n) => n - 1);
        }
      }),
    );
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setUploads((n) => n + 1);
    try {
      const item = await uploadImage(file);
      update({ cover: item.url });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "封面上传失败");
    } finally {
      setUploads((n) => n - 1);
    }
  }

  async function publish() {
    const scheduled = new Date(post.date).getTime() > Date.now() + 60_000;
    const status: PostStatus = scheduled ? "scheduled" : "published";
    if (await persist({ status })) {
      setNotice(scheduled ? `已设为定时发布，将于 ${formatDateTime(post.date)} 上线` : "已发布");
    }
  }

  async function unpublish() {
    if (await persist({ status: "draft" })) setNotice("已撤回为草稿，访客将看不到这篇文章");
  }

  const primaryLabel =
    post.status === "draft"
      ? new Date(post.date).getTime() > Date.now() + 60_000
        ? "定时发布"
        : "发布"
      : "更新";

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/92 px-3 backdrop-blur sm:px-5">
        <a
          href="/admin/posts"
          onClick={(e) => {
            if (dirty && !confirm("还有未保存的修改，确定离开吗？")) e.preventDefault();
          }}
          className="inline-flex size-10 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="返回文章列表"
        >
          <ArrowLeft className="size-[1.1rem]" strokeWidth={1.7} />
        </a>
        <span
          className={cn(
            "mono shrink-0 border px-1.5 py-0.5 text-[0.625rem] tracking-[0.12em] whitespace-nowrap uppercase",
            post.status === "draft" ? "border-line-strong text-muted" : "border-accent/50 text-accent-ink",
          )}
        >
          {STATUS_LABEL[post.status]}
        </span>
        <SaveIndicator state={save} uploads={uploads} live={isLiveEdit} />

        <div className="ml-auto flex items-center gap-1.5">
          {/* Mobile write/preview switch */}
          <div role="tablist" aria-label="编辑模式" className="flex border border-line p-0.5 lg:hidden">
            {(["write", "preview"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "h-8 px-3 text-sm whitespace-nowrap transition-colors",
                  tab === t ? "bg-ink text-bg" : "text-muted hover:text-ink",
                )}
              >
                {t === "write" ? "编辑" : "预览"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            aria-controls="post-settings"
            className={cn(
              "inline-flex size-10 items-center justify-center transition-colors hover:bg-surface-2 hover:text-ink",
              panelOpen ? "bg-surface-2 text-ink" : "text-muted",
            )}
            aria-label="文章设置"
          >
            <SlidersHorizontal className="size-[1.05rem]" strokeWidth={1.7} />
          </button>
          {post.status === "draft" && (
            <button
              type="button"
              onClick={() => void persist()}
              disabled={save.kind === "saving" || !dirty}
              className="btn btn-ghost hidden h-9 px-3.5 text-sm disabled:opacity-50 sm:inline-flex"
            >
              保存草稿
            </button>
          )}
          <button
            type="button"
            onClick={() => void (post.status === "draft" ? publish() : persist())}
            disabled={save.kind === "saving" || uploads > 0 || (post.status !== "draft" && !dirty)}
            className="btn btn-primary h-9 px-4 text-sm disabled:opacity-50"
          >
            {primaryLabel}
          </button>
        </div>
      </header>

      <div className="relative flex flex-1">
        {/* Writing surface */}
        <section
          aria-label="编辑区"
          className={cn("flex min-w-0 flex-1 flex-col lg:border-r lg:border-line", tab === "preview" && "max-lg:hidden")}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void insertImages(imageFiles(e.dataTransfer.files));
          }}
        >
          <div className="mx-auto w-full max-w-[44rem] px-5 pt-8 sm:px-8 sm:pt-12">
            <label htmlFor="post-title" className="sr-only">
              标题
            </label>
            <textarea
              id="post-title"
              rows={1}
              value={post.title}
              placeholder="标题"
              onChange={(e) => {
                const title = e.target.value.replace(/\n/g, "");
                update(slugTouched ? { title } : { title, slug: title.trim() ? slugify(title) : "" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  textRef.current?.focus();
                }
              }}
              className="field-sizing-content w-full resize-none bg-transparent text-[1.875rem] font-[680] leading-[1.25] tracking-[-0.025em] text-ink outline-none placeholder:text-faint sm:text-[2.25rem]"
            />
          </div>

          {/* Toolbar */}
          <div className="sticky top-14 z-10 border-b border-line bg-bg/92 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[44rem] items-center gap-0.5 overflow-x-auto px-3 py-1.5 sm:px-6">
              {tools.map(({ label, icon: Icon, run, hideOnMobile }) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  aria-label={label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={run}
                  className={cn(
                    "inline-flex size-10 shrink-0 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-ink",
                    hideOnMobile && "max-sm:hidden",
                  )}
                >
                  <Icon className="size-[1.05rem]" strokeWidth={1.7} />
                </button>
              ))}
              <span className="mx-1.5 h-5 w-px shrink-0 bg-line" aria-hidden />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <ImagePlus className="size-[1.05rem]" strokeWidth={1.7} />
                插入图片
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  void insertImages(imageFiles(e.target.files));
                  e.target.value = "";
                }}
              />
              <span className="ml-auto shrink-0 pl-3 text-xs tabular-nums text-faint max-sm:hidden">
                {stats.wordCount} 字，约 {stats.readingTime} 分钟
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[44rem] flex-1 px-5 pb-32 pt-6 sm:px-8">
            <label htmlFor="post-body" className="sr-only">
              正文（Markdown）
            </label>
            <textarea
              id="post-body"
              ref={textRef}
              value={post.content}
              onChange={(e) => update({ content: e.target.value })}
              onPaste={(e) => {
                const files = imageFiles(e.clipboardData.files);
                if (files.length) {
                  e.preventDefault();
                  void insertImages(files);
                }
              }}
              placeholder={"从这里开始写。支持 Markdown。\n\n图片可以直接粘贴或拖进来。"}
              spellCheck={false}
              className="field-sizing-content min-h-[60vh] w-full resize-none bg-transparent font-mono text-[0.9375rem] leading-[1.85] text-ink-soft outline-none placeholder:text-faint"
            />
            {dragging && (
              <div className="pointer-events-none absolute inset-3 grid place-items-center border-2 border-dashed border-accent/60 bg-accent-soft/60 text-sm text-accent-ink">
                松开即可上传图片
              </div>
            )}
          </div>
        </section>

        {/* Preview */}
        <section
          aria-label="预览"
          className={cn("min-w-0 flex-1 overflow-y-auto bg-surface/40", tab === "write" && "max-lg:hidden")}
        >
          <div className="mx-auto max-w-[42rem] px-5 pb-32 pt-8 sm:px-10 sm:pt-12">
            {post.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.cover} alt="" className="mb-8 aspect-[16/9] w-full border border-line object-cover" />
            )}
            <h1 className="text-balance text-[2rem] font-[680] leading-[1.2] tracking-[-0.025em]">
              {post.title || <span className="text-faint">未命名</span>}
            </h1>
            {post.content.trim() ? (
              <Markdown source={post.content} className="mt-8" />
            ) : (
              <p className="mt-8 text-muted">正文预览会显示在这里。</p>
            )}
          </div>
        </section>

        {/* Settings panel */}
        {panelOpen && (
          <div className="fixed inset-0 z-30 bg-ink/20 lg:hidden" onClick={() => setPanelOpen(false)} aria-hidden />
        )}
        <aside
          id="post-settings"
          aria-label="文章设置"
          hidden={!panelOpen}
          className="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto border-t border-line-strong bg-surface pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow)] lg:sticky lg:top-14 lg:inset-auto lg:z-0 lg:h-[calc(100dvh-3.5rem)] lg:max-h-none lg:w-[20rem] lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none"
        >
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <h2 className="text-[0.9375rem] font-[620]">文章设置</h2>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="inline-flex size-10 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="关闭文章设置"
            >
              <X className="size-[1.05rem]" strokeWidth={1.7} />
            </button>
          </div>
          <div className="space-y-6 px-5 pb-4">
            <Field label="链接名" hint={`/posts/${post.slug || "…"}`}>
              <input
                className="field h-10 font-mono text-sm"
                value={post.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") });
                }}
                spellCheck={false}
                autoCapitalize="off"
              />
            </Field>

            <Field
              label="发布时间"
              hint={post.status === "draft" ? "设成未来的时间，点发布后就会定时上线" : undefined}
            >
              <input
                type="datetime-local"
                className="field h-10 text-sm"
                value={toLocalInput(post.date)}
                onChange={(e) => update({ date: fromLocalInput(e.target.value) })}
              />
            </Field>

            <Field label="标签" hint="用逗号或空格分隔">
              <TagInput tags={post.tags} onChange={(tags) => update({ tags })} />
            </Field>

            <Field label="系列" hint="留空表示不属于系列；同一系列的文章会按时间自动编号">
              <input
                className="field h-10 text-sm"
                value={post.series ?? ""}
                onChange={(e) => update({ series: e.target.value })}
                placeholder="比如 版式实验"
              />
            </Field>

            <Field label="摘要" hint="留空会自动截取正文开头">
              <textarea
                className="field min-h-24 resize-y py-2.5 text-sm leading-relaxed"
                value={post.excerpt ?? ""}
                maxLength={280}
                onChange={(e) => update({ excerpt: e.target.value })}
              />
            </Field>

            <div>
              <span className="text-sm font-[550] text-ink-soft">封面</span>
              {post.cover ? (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.cover} alt="当前封面" className="aspect-[16/9] w-full border border-line-strong object-cover" />
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn btn-ghost h-9 flex-1 text-sm" onClick={() => coverRef.current?.click()}>
                      更换
                    </button>
                    <button type="button" className="btn btn-ghost h-9 flex-1 text-sm" onClick={() => update({ cover: "" })}>
                      移除封面
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverRef.current?.click()}
                  className="mt-2 flex aspect-[16/9] w-full items-center justify-center gap-2 border border-dashed border-line-strong text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink"
                >
                  <ImagePlus className="size-4" strokeWidth={1.7} />
                  上传封面
                </button>
              )}
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void uploadCover(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-[550] text-ink-soft">精选</span>
                <span className="block text-xs text-muted">放在首页顶部</span>
              </span>
              <input
                type="checkbox"
                checked={post.featured ?? false}
                onChange={(e) => update({ featured: e.target.checked })}
                className="size-5 accent-[var(--accent)]"
              />
            </label>

            {post.status !== "draft" && (
              <div className="border-t border-line pt-5">
                <button type="button" onClick={() => void unpublish()} className="btn btn-ghost h-10 w-full text-sm">
                  撤回为草稿
                </button>
                {originalSlug && post.status === "published" && (
                  <a href={`/posts/${originalSlug}`} target="_blank" className="link-underline mt-3 block text-center text-sm text-muted">
                    在站点中查看
                  </a>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {notice && (
          <p className="pointer-events-auto max-w-md border border-line-strong bg-ink px-4 py-2.5 text-sm text-bg shadow-[var(--shadow)]">{notice}</p>
        )}
      </div>
    </div>
  );
}

function SaveIndicator({ state, uploads, live }: { state: SaveState; uploads: number; live: boolean }) {
  let text = "";
  let tone = "text-faint";
  if (uploads > 0) text = `正在上传 ${uploads} 张图片…`;
  else if (state.kind === "saving") text = "保存中…";
  else if (state.kind === "saved") text = `已保存 ${formatDateTime(state.at).slice(-5)}`;
  else if (state.kind === "dirty") text = live ? "有未发布的修改" : "未保存";
  else if (state.kind === "error") {
    text = state.message;
    tone = "text-accent-ink";
  }
  return (
    <span role="status" aria-live="polite" className={cn("truncate text-xs max-sm:max-w-[7rem]", tone)}>
      {text}
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-[550] text-ink-soft">{label}</span>
      <div className="mt-2">{children}</div>
      {hint && <span className="mt-1.5 block break-all text-xs text-muted">{hint}</span>}
    </label>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function commit(raw: string) {
    const added = raw.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean);
    if (added.length) onChange([...new Set([...tags, ...added])].slice(0, 12));
    setDraft("");
  }
  return (
    <div className="field flex min-h-10 flex-wrap items-center gap-1.5 py-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 border border-line-strong bg-surface-2 py-0.5 pr-1 pl-2 text-xs text-ink-soft">
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="inline-flex size-5 items-center justify-center text-muted transition-colors hover:bg-line hover:text-ink"
            aria-label={`移除标签 ${t}`}
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (/[,，\s]$/.test(v)) commit(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={tags.length ? "" : "比如 随笔 前端"}
        className="min-w-[5rem] flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
      />
    </div>
  );
}
