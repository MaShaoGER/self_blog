"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ResourceSummary } from "@/shared/resource-types";
import { ResourcePreview } from "./resource-preview";

export function ResourceEmbed({ id }: { id: string }) {
  const [resource, setResource] = useState<ResourceSummary | null>(null);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResource(null);
    setMessage("");
    void (async () => {
      try {
        // The editor also uses this renderer; never import server-only storage here.
        // Anonymous metadata keeps private resources out of published Markdown.
        const response = await fetch(`/api/resources/${encodeURIComponent(id)}`, { credentials: "omit", cache: "no-store", signal: controller.signal });
        if (response.status === 404) {
          if (!controller.signal.aborted) setMessage("该资源尚未公开，或已被移除。");
          return;
        }
        if (!response.ok) throw new Error("资源暂时无法读取，请稍后重试。");
        const data = await response.json() as ResourceSummary;
        if (!data || data.id !== id || typeof data.name !== "string") throw new Error("资源响应无效。");
        if (!controller.signal.aborted) setResource(data);
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "资源加载失败。");
      }
    })();
    return () => controller.abort();
  }, [id, attempt]);

  return (
    <section aria-label={resource?.name ?? "文章资源"} className="not-prose my-7 border-y border-line py-5">
      {resource ? <><h3 className="mb-4 text-lg font-semibold"><Link href={`/resources/${encodeURIComponent(id)}`} className="underline underline-offset-4">{resource.name}</Link></h3><ResourcePreview resource={resource} /></> : message ? <div role="status"><p className="text-sm text-muted">{message}</p><button type="button" className="keybtn mt-3" onClick={() => setAttempt(n => n + 1)}>重新读取</button></div> : <p role="status" className="text-sm text-muted">正在读取资源…</p>}
    </section>
  );
}
