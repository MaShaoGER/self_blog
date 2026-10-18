"use client";

import { useRef, useState } from "react";
import { Check, Copy, ImageUp, Trash2 } from "lucide-react";
import { deleteUploadAction } from "@/app/admin/(shell)/media/actions";
import { imageFiles, uploadImage } from "@/components/admin/editor/upload";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { UploadItem } from "@/lib/types";
import { ConfirmButton } from "./confirm-button";
import { LiveRegion, useAnnouncer } from "./live-region";

type Job = { id: string; name: string; state: "uploading" | "error"; error?: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileName(path: string) {
  return path.split("/").pop() ?? path;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 非安全上下文（如局域网 http 访问）下 clipboard API 不可用
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function MediaLibrary({ initial }: { initial: UploadItem[] }) {
  const [items, setItems] = useState(initial);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const { message, announce } = useAnnouncer();

  async function upload(list: FileList | File[] | null) {
    const files = imageFiles(list);
    if (!files.length) {
      if (list && Array.from(list).length) announce("只能上传图片文件");
      return;
    }
    announce(`正在上传 ${files.length} 张图片`);
    let ok = 0;
    await Promise.all(
      files.map(async (file) => {
        const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
        setJobs((j) => [...j, { id, name: file.name, state: "uploading" }]);
        try {
          const item = await uploadImage(file);
          ok++;
          setItems((cur) => [item, ...cur.filter((x) => x.path !== item.path)]);
          setJobs((j) => j.filter((x) => x.id !== id));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "上传失败";
          setJobs((j) => j.map((x) => (x.id === id ? { ...x, state: "error", error: msg } : x)));
        }
      }),
    );
    const failed = files.length - ok;
    announce(failed ? `上传完成 ${ok} 张，${failed} 张失败` : `已上传 ${ok} 张图片`);
  }

  async function copy(item: UploadItem) {
    const ok = await copyText(`![](${item.url})`);
    if (ok) {
      setCopied(item.path);
      setTimeout(() => setCopied((c) => (c === item.path ? null : c)), 1800);
      announce("已复制 Markdown 代码");
    } else {
      announce("复制失败，请长按图片地址手动复制");
    }
  }

  return (
    <div
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void upload(e.dataTransfer.files);
      }}
    >
      <LiveRegion message={message} />

      {/* 上传区：整页都可以拖放，这里是点选入口和拖放落点提示 */}
      <div
        className={cn(
          "mt-6 flex flex-col items-start gap-4 rounded-lg border border-dashed px-4 py-5 transition-colors sm:flex-row sm:items-center sm:justify-between md:px-5",
          dragging ? "border-accent bg-accent-soft/60" : "border-line-strong",
        )}
      >
        <div className="flex items-center gap-3.5">
          <ImageUp aria-hidden strokeWidth={1.5} className={cn("size-6 shrink-0", dragging ? "text-accent" : "text-muted")} />
          <div>
            <p className="text-[0.9375rem] text-ink">{dragging ? "松手即可上传" : "把图片拖到这里，或者从设备里选择"}</p>
            <p className="mt-0.5 text-[0.8125rem] text-muted">JPG、PNG、WebP、GIF、AVIF，单张不超过 15 MB，可多选</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn btn-primary h-11! w-full sm:w-auto md:h-10!"
        >
          选择图片
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void upload(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {jobs.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-y border-line text-[0.8125rem]">
          {jobs.map((j) => (
            <li key={j.id} className="flex min-h-11 items-center justify-between gap-4 py-2">
              <span className="min-w-0 truncate text-ink-soft">{j.name}</span>
              {j.state === "uploading" ? (
                <span className="flex shrink-0 items-center gap-2 text-muted">
                  <span aria-hidden className="admin-spinner" />
                  上传中
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-accent-ink">{j.error}</span>
                  <button
                    type="button"
                    className="-my-2 h-11 cursor-pointer px-1 text-muted hover:text-ink"
                    onClick={() => setJobs((cur) => cur.filter((x) => x.id !== j.id))}
                  >
                    知道了
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex items-baseline justify-between border-b border-line pb-2.5">
        <h2 className="text-[0.9375rem] font-semibold text-ink">全部图片</h2>
        <span className="text-[0.8125rem] tabular-nums text-muted">{items.length} 张</span>
      </div>

      {items.length ? (
        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const name = fileName(item.path);
            const isCopied = copied === item.path;
            return (
              <li key={item.path} className="group min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-[4/3] overflow-hidden rounded-md border border-line bg-surface-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 已是压缩后的 WebP，直接输出 */}
                  <img
                    src={item.url}
                    alt={`图片 ${name}`}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </a>
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 pt-0.5">
                    <p className="truncate font-mono text-[0.75rem] text-ink-soft" title={item.path}>
                      {name}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] tabular-nums text-muted">
                      {formatSize(item.size)}
                      <span className="ml-2">{formatDateShort(item.createdAt)}</span>
                    </p>
                  </div>
                  <div className="-mr-2 -mt-1.5 flex shrink-0">
                    <button
                      type="button"
                      onClick={() => void copy(item)}
                      aria-label={`复制 ${name} 的 Markdown 代码`}
                      title="复制 Markdown 代码"
                      className={cn(
                        "inline-flex size-11 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-2 md:size-9",
                        isCopied ? "text-green" : "text-muted hover:text-ink",
                      )}
                    >
                      {isCopied ? (
                        <Check aria-hidden strokeWidth={1.8} className="size-4" />
                      ) : (
                        <Copy aria-hidden strokeWidth={1.6} className="size-4" />
                      )}
                    </button>
                    <ConfirmButton
                      aria-label={`删除图片 ${name}`}
                      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-accent-ink md:size-9"
                      title="删除这张图片？"
                      description={
                        <>
                          图片文件会被永久删除。已经引用它的文章会显示成破图，删除前请确认没有文章在用。
                        </>
                      }
                      confirmLabel="删除图片"
                      action={async () => {
                        await deleteUploadAction(item.path);
                        setItems((cur) => cur.filter((x) => x.path !== item.path));
                        announce(`已删除图片 ${name}`);
                      }}
                    >
                      <Trash2 aria-hidden strokeWidth={1.6} className="size-4" />
                    </ConfirmButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="py-14 text-center">
          <p className="text-[0.9375rem] font-medium text-ink">图库还是空的</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[0.875rem] leading-relaxed text-muted">
            点上面的「选择图片」或直接拖进来。上传后点复制按钮，就能把图片代码贴进文章。
          </p>
        </div>
      )}
    </div>
  );
}
