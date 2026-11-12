"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Link2, LoaderCircle, Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { parseVideoLink } from "@/shared/video-links";
import { MAX_VIDEO_BYTES, type VideoInsertResult, type VideoLinkFormat } from "@/shared/video-types";

const MAX_MB = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));
const RESOURCE_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const FORMAT_OPTIONS: { value: "" | VideoLinkFormat; label: string }[] = [
  { value: "", label: "按链接自动判断" },
  { value: "mp4", label: "MP4" },
  { value: "webm", label: "WebM" },
  { value: "hls", label: "HLS（m3u8）" },
];

type Mode = "upload" | "link";
type InsertPayload = (VideoInsertResult & { error?: string }) | null;

/** 选中的文件决定了 Content-Type 与发送给服务的文件扩展名。 */
function videoMeta(file: File): { mime: "video/mp4" | "video/webm"; ext: ".mp4" | ".webm" } | { error: string } {
  if (file.size <= 0) return { error: "文件是空的，请重新选择" };
  if (file.size > MAX_VIDEO_BYTES) return { error: `视频文件超过 ${MAX_MB} MB 上限` };
  if (file.type === "video/mp4") return { mime: "video/mp4", ext: ".mp4" };
  if (file.type === "video/webm") return { mime: "video/webm", ext: ".webm" };
  if (file.type) return { error: "只支持 MP4 或 WebM 视频文件" };
  // 有些系统不提供 MIME，只能按扩展名判断。
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mp4")) return { mime: "video/mp4", ext: ".mp4" };
  if (lower.endsWith(".webm")) return { mime: "video/webm", ext: ".webm" };
  return { error: "只支持 MP4 或 WebM 视频文件" };
}

function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function sanitizeBase(raw: string): string {
  return raw
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/[\u0000-\u001f\u007f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * 插入视频：本地上传（原样 POST 文件体）或登记视频网站/直链。
 * 组件只在需要时挂载；关闭、取消、Esc 都会中止仍在进行的请求。
 */
export function VideoDialog({ onClose, onInsert }: { onClose: () => void; onInsert: (id: string) => void }) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const introId = `${uid}-intro`;
  const fileId = `${uid}-file`;
  const fileHintId = `${uid}-file-hint`;
  const nameId = `${uid}-name`;
  const urlId = `${uid}-url`;
  const urlHintId = `${uid}-url-hint`;
  const formatId = `${uid}-format`;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const aliveRef = useRef(true);
  const closedRef = useRef(false);
  const settledRef = useRef(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoNameRef = useRef("");
  const handoffRef = useRef(false);

  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [linkName, setLinkName] = useState("");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"" | VideoLinkFormat>("");
  const [busy, setBusy] = useState<Mode | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loading = busy !== null;
  const name = mode === "upload" ? uploadName : linkName;
  const setName = mode === "upload" ? setUploadName : setLinkName;

  useEffect(() => {
    aliveRef.current = true;
    closedRef.current = false;
    settledRef.current = false;
    handoffRef.current = false;
    if (!openerRef.current) {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement ? active : null;
    }
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    (mode === "upload" ? fileRef.current : urlRef.current)?.focus();
    return () => {
      aliveRef.current = false;
      closedRef.current = true;
      xhrRef.current?.abort();
      abortRef.current?.abort();
      xhrRef.current = null;
      abortRef.current = null;
      if (dialog?.open) dialog.close();
      if (handoffRef.current) return;
      const opener = openerRef.current;
      const active = document.activeElement;
      if (opener?.isConnected && (!active || active === document.body || dialog?.contains(active))) opener.focus();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function requestClose() {
    if (closedRef.current) return;
    closedRef.current = true;
    aliveRef.current = false;
    xhrRef.current?.abort();
    abortRef.current?.abort();
    dialogRef.current?.close();
    onClose();
  }

  function fail(message: string) {
    if (!aliveRef.current || closedRef.current) return;
    settledRef.current = true;
    setBusy(null);
    setProgress(0);
    setError(message);
  }

  function finishInsert(status: number, data: InsertPayload) {
    if (!aliveRef.current || closedRef.current || settledRef.current) return;
    if (status === 401) return fail("登录已失效，请重新登录后再插入视频");
    if (status === 413) return fail(`视频超过 ${MAX_MB} MB 上限，请压缩或换更小的文件`);
    if (status === 415) return fail("只支持 MP4 或 WebM 视频，请检查文件或链接格式");
    if (status < 200 || status >= 300) {
      return fail(data?.error?.trim() || "服务器未能保存这个视频，请重试");
    }
    const id = data && typeof data.id === "string" ? data.id.trim() : "";
    if (!RESOURCE_ID.test(id)) return fail("服务器返回的资源编号无效，请重试");
    settledRef.current = true;
    handoffRef.current = true;
    setBusy(null);
    setProgress(100);
    onInsert(id);
    onClose();
  }

  function submitUpload() {
    const picked = file;
    if (!picked) {
      setError("请选择要上传的视频文件");
      fileRef.current?.focus();
      return;
    }
    const meta = videoMeta(picked);
    if ("error" in meta) {
      setError(meta.error);
      fileRef.current?.focus();
      return;
    }
    const typed = sanitizeBase(name.trim().replace(/\.(mp4|webm)$/i, ""));
    const suggested = sanitizeBase(baseName(picked.name));
    const base = [typed, suggested].find((candidate) => candidate && !/^\.+$/.test(candidate)) ?? "视频";
    const filename = `${base}${meta.ext}`;

    settledRef.current = false;
    setError(null);
    setBusy("upload");
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/videos");
    xhr.setRequestHeader("Content-Type", meta.mime);
    xhr.setRequestHeader("X-Upload-Name", encodeURIComponent(filename));
    xhr.upload.onprogress = (event) => {
      if (!aliveRef.current || closedRef.current) return;
      if (event.lengthComputable && event.total > 0) {
        setProgress(Math.min(99, Math.max(0, Math.round((event.loaded / event.total) * 100))));
      }
    };
    xhr.onload = () => {
      xhrRef.current = null;
      if (!aliveRef.current || closedRef.current) return;
      let data: InsertPayload = null;
      try {
        data = JSON.parse(xhr.responseText) as InsertPayload;
      } catch {
        data = null;
      }
      finishInsert(xhr.status, data);
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      fail("网络连接中断，请重试");
    };
    xhr.onabort = () => {
      xhrRef.current = null;
    };
    xhr.send(picked);
  }

  async function submitLink() {
    const raw = url.trim();
    if (!raw) {
      setError("请粘贴视频链接");
      urlRef.current?.focus();
      return;
    }
    if (raw.length > 8192) {
      setError("链接过长，请检查后重试");
      urlRef.current?.focus();
      return;
    }
    if (!/^https:\/\//i.test(raw)) {
      setError("请填写完整的 https 视频链接");
      urlRef.current?.focus();
      return;
    }
    try {
      parseVideoLink(raw, format || undefined);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "无法识别这个视频链接");
      urlRef.current?.focus();
      return;
    }

    settledRef.current = false;
    setError(null);
    setBusy("link");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: raw,
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(format ? { format } : {}),
        }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as InsertPayload;
      finishInsert(res.status, data);
    } catch (err) {
      if (closedRef.current) return;
      if (err instanceof Error && err.name === "AbortError") return;
      fail("网络连接中断，请重试");
    } finally {
      abortRef.current = null;
    }
  }

  function submit() {
    if (closedRef.current || xhrRef.current || abortRef.current) return;
    if (mode === "upload") submitUpload();
    else void submitLink();
  }

  function changeMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    requestAnimationFrame(() => {
      if (!aliveRef.current) return;
      (next === "upload" ? fileRef.current : urlRef.current)?.focus();
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={introId}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[34rem] overflow-y-auto border border-line-ink bg-bg p-0 text-ink shadow-[var(--shadow)] backdrop:bg-black/35"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        // 只有落在面板外的点击才算点遮罩；滚动条与内边距不误触。
        const rect = event.currentTarget.getBoundingClientRect();
        const { clientX, clientY } = event;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) requestClose();
      }}
    >
      <form
        noValidate
        aria-busy={loading}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[1rem] font-[620] text-ink">
              插入视频
            </h2>
            <p id={introId} className="mt-1 text-xs leading-relaxed text-muted">
              上传本地文件或粘贴视频网站链接，成功后会在光标处插入播放块。
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="关闭插入视频"
            className="-mr-1 inline-flex size-11 shrink-0 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-[1.05rem]" strokeWidth={1.7} />
          </button>
        </div>

        <div role="group" aria-label="视频来源" className="mt-4 flex border border-line p-0.5">
          <button
            type="button"
            aria-pressed={mode === "upload"}
            aria-label="本地上传视频文件"
            disabled={loading}
            onClick={() => changeMode("upload")}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-1.5 text-sm transition-colors disabled:opacity-60",
              mode === "upload" ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Upload className="size-4" strokeWidth={1.7} />
            本地上传
          </button>
          <button
            type="button"
            aria-pressed={mode === "link"}
            aria-label="使用视频链接"
            disabled={loading}
            onClick={() => changeMode("link")}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-1.5 text-sm transition-colors disabled:opacity-60",
              mode === "link" ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Link2 className="size-4" strokeWidth={1.7} />
            视频链接
          </button>
        </div>

        {mode === "upload" ? (
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor={fileId} className="block text-sm font-[550] text-ink-soft">
                视频文件
              </label>
              <input
                id={fileId}
                ref={fileRef}
                type="file"
                accept="video/mp4,video/webm,.mp4,.webm"
                disabled={loading}
                aria-describedby={fileHintId}
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  setFile(next);
                  setError(null);
                  if (!next) return;
                  const meta = videoMeta(next);
                  if ("error" in meta) {
                    setError(meta.error);
                    return;
                  }
                  const suggested = sanitizeBase(baseName(next.name));
                  if (!uploadName.trim() || uploadName === autoNameRef.current) {
                    autoNameRef.current = suggested;
                    setUploadName(suggested);
                  }
                }}
                className="field mt-1.5 min-h-11 w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-[550] file:text-bg disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p id={fileHintId} className="mt-1.5 text-xs leading-relaxed text-muted">
                MP4 或 WebM，单文件最大 {MAX_MB} MB。
                {file ? ` 已选：${file.name} · ${formatBytes(file.size)}` : ""}
              </p>
            </div>

            <p className="border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
              上传后可通过链接访问；不会自动出现在公开资源目录，请勿上传敏感视频。
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor={urlId} className="block text-sm font-[550] text-ink-soft">
                视频链接
              </label>
              <input
                id={urlId}
                ref={urlRef}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                maxLength={8192}
                disabled={loading}
                aria-describedby={urlHintId}
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError(null);
                }}
                placeholder="https://www.youtube.com/watch?v=… 或 https://www.bilibili.com/video/BV…"
                className="field mt-1.5 h-11 text-sm"
              />
              <p id={urlHintId} className="mt-1.5 text-xs leading-relaxed text-muted">
                支持 YouTube、哔哩哔哩视频页，以及 MP4 / WebM / HLS 直链。
              </p>
            </div>

            <div>
              <label htmlFor={formatId} className="block text-sm font-[550] text-ink-soft">
                直链格式（可选）
              </label>
              <select
                id={formatId}
                value={format}
                disabled={loading}
                onChange={(event) => {
                  setFormat(event.target.value as "" | VideoLinkFormat);
                  setError(null);
                }}
                className="field mt-1.5 h-11 text-sm"
              >
                {FORMAT_OPTIONS.map((option) => (
                  <option key={option.value || "auto"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                地址看不出格式时再指定，例如 .m3u8 播放列表。
              </p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label htmlFor={nameId} className="block text-sm font-[550] text-ink-soft">
            名称（可选）
          </label>
          <input
            id={nameId}
            value={name}
            disabled={loading}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder={mode === "upload" && file ? baseName(file.name) || "视频" : "视频"}
            className="field mt-1.5 h-11 text-sm"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            仅用于资源管理里的标记，不会作为正文文字插入。
          </p>
        </div>

        <div className="mt-4">
          <p role="status" aria-live="polite" className={cn("text-xs text-muted", !busy && "sr-only")}>
            {busy === "upload" ? "正在上传视频…" : busy === "link" ? "正在登记视频链接…" : ""}
          </p>
          {busy === "upload" && (
            <div className="mt-1.5">
              <div
                role="progressbar"
                aria-label="视频上传进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-1.5 w-full border border-line-strong bg-surface"
              >
                <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p aria-hidden className="mt-1 text-right text-xs tabular-nums text-faint">
                {progress}%
              </p>
            </div>
          )}
        </div>

        <p
          role="alert"
          className={cn(
            "mt-4 text-sm leading-relaxed",
            error ? "border border-accent/40 bg-accent-soft px-3 py-2 text-accent-ink" : "sr-only",
          )}
        >
          {error ?? ""}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={requestClose} className="btn btn-ghost h-11! text-sm sm:h-10!">
            取消
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary h-11! text-sm sm:h-10! disabled:opacity-50">
            {loading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                {busy === "upload" ? `上传中… ${progress}%` : "处理中…"}
              </>
            ) : mode === "upload" ? (
              "上传并插入"
            ) : (
              "插入视频"
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
