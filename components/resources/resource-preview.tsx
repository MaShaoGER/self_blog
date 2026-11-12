"use client";

import { useEffect, useState } from "react";
import type { ResourceSource, ResourceSummary } from "@/shared/resource-types";
import { VideoPlayer } from "./video-player";
import { ModelViewer } from "./model-viewer";

type AccessState = { source: ResourceSource; error?: never } | { source?: never; error: string } | null;

export function ResourcePreview({ resource }: { resource: ResourceSummary }) {
  const [state, setState] = useState<AccessState>(null);
  const [attempt, setAttempt] = useState(0);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState(null);
    setImageError(false);
    if (resource.kind === "folder") return () => controller.abort();
    void (async () => {
      try {
        const response = await fetch(`/api/resources/${encodeURIComponent(resource.id)}/access`, {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "preview" }), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "资源暂时无法访问");
        if (!data || (data.type !== "direct" && data.type !== "embed")) throw new Error("资源访问响应无效");
        if (!controller.signal.aborted) setState({ source: data as ResourceSource });
      } catch (error) {
        if (!controller.signal.aborted) setState({ error: error instanceof Error ? error.message : "资源加载失败" });
      }
    })();
    return () => controller.abort();
  }, [resource.id, resource.kind, attempt]);

  if (resource.kind === "folder") return <a href={`/resources?folder=${encodeURIComponent(resource.id)}`} className="keybtn">打开目录</a>;
  if (!state) return <p role="status" className="py-8 text-sm text-muted">正在获取访问权限…</p>;
  if (state.error) return <div role="alert" className="border border-line p-5"><p className="text-sm text-accent-ink">{state.error}</p><button type="button" className="keybtn mt-4" onClick={() => setAttempt(n => n + 1)}>重新获取</button></div>;
  const source = state.source;
  if (!source) return null;

  return (
    <div className="min-w-0 space-y-5">
      {resource.kind === "video" ? <VideoPlayer source={source} title={resource.name} /> : null}
      {resource.kind === "model" && source.type === "direct" ? <ModelViewer src={source.url} title={resource.name} /> : null}
      {resource.kind === "image" && source.type === "direct" ? (
        <figure className="border border-line bg-surface p-3">
          {imageError ? <p role="alert" className="p-5 text-sm text-accent-ink">图片加载失败。请检查源站链接是否过期或限制跨域访问。</p> : <img src={source.url} alt={resource.name} referrerPolicy="no-referrer" className="mx-auto max-h-[70dvh] max-w-full object-contain" onError={() => setImageError(true)} />}
        </figure>
      ) : null}
      {resource.kind === "file" ? <p className="border-y border-line py-6 text-sm leading-relaxed text-muted">此类工程或素材文件不在网页内执行。可以下载后在对应软件中打开。</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        {source.type === "direct" ? <a href={`/api/resources/${encodeURIComponent(resource.id)}/download`} className="keybtn">下载 / 在源站打开</a> : <p className="text-xs text-muted">此视频使用平台官方播放器，不提供视频提取下载。</p>}
        {source.type === "direct" && source.expiresAt ? <p className="text-xs text-muted">临时链接有效期至 {source.expiresAt.replace("T", " ").replace("Z", " UTC")}</p> : null}
      </div>
    </div>
  );
}
