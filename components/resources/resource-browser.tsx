"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  ChevronRight,
  Download,
  FileText,
  Folder,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  Video,
} from "lucide-react";
import type { ResourceKind, ResourceListing, ResourceSummary } from "@/shared/resource-types";
import styles from "./resource-browser.module.css";

const KIND_LABELS: Record<ResourceKind, string> = {
  folder: "文件夹",
  video: "视频",
  model: "模型",
  image: "图片",
  file: "文件",
};

function kindIcon(kind: ResourceKind) {
  switch (kind) {
    case "folder":
      return <Folder aria-hidden="true" />;
    case "video":
      return <Video aria-hidden="true" />;
    case "model":
      return <Box aria-hidden="true" />;
    case "image":
      return <ImageIcon aria-hidden="true" />;
    default:
      return <FileText aria-hidden="true" />;
  }
}

function formatSize(bytes: number | undefined): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function folderHref(id: string | null): string {
  return id ? `/resources?folder=${encodeURIComponent(id)}` : "/resources";
}

function isListing(value: unknown): value is ResourceListing {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ResourceListing>;
  return (
    Array.isArray(candidate.items) &&
    Array.isArray(candidate.breadcrumbs) &&
    (candidate.nextCursor === null || typeof candidate.nextCursor === "string")
  );
}

const DOWNLOADABLE: Record<ResourceKind, boolean> = {
  folder: false,
  video: false,
  model: true,
  image: true,
  file: true,
};

function mergeItems(current: ResourceSummary[], incoming: ResourceSummary[]): ResourceSummary[] {
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export function ResourceBrowser({ initialParentId }: { initialParentId?: string }) {
  const [parentId, setParentId] = useState<string | null>(initialParentId || null);
  const [listing, setListing] = useState<ResourceListing | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState("资源列表加载失败，请检查网络后重试。");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const generation = useRef(0);
  const moreAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    setParentId(initialParentId || null);
  }, [initialParentId]);

  useEffect(() => {
    const controller = new AbortController();
    const current = generation.current + 1;
    generation.current = current;
    moreAbort.current?.abort();
    setStatus("loading");
    setListing(null);
    setMoreError(null);
    setLoadingMore(false);

    const params = new URLSearchParams();
    if (parentId) params.set("parentId", parentId);
    const query = params.toString();

    (async () => {
      try {
        const response = await fetch(`/api/resources${query ? `?${query}` : ""}`, {
          signal: controller.signal,
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(response.status === 404 ? "not-found" : "http");
        const data: unknown = await response.json();
        if (!isListing(data)) throw new Error("invalid listing");
        if (generation.current !== current) return;
        setListing(data);
        setStatus("ready");
      } catch (error) {
        if (controller.signal.aborted || generation.current !== current) return;
        setErrorMessage(
          error instanceof Error && error.message === "not-found"
            ? "这个文件夹不存在，或者需要登录后台账号才能查看。"
            : "资源列表加载失败，请检查网络后重试。",
        );
        setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [parentId, reloadKey]);

  useEffect(() => () => moreAbort.current?.abort(), []);

  const loadMore = useCallback(async () => {
    if (!listing?.nextCursor || loadingMore) return;
    const current = generation.current;
    const cursor = listing.nextCursor;
    moreAbort.current?.abort();
    const controller = new AbortController();
    moreAbort.current = controller;
    setLoadingMore(true);
    setMoreError(null);

    const params = new URLSearchParams();
    if (parentId) params.set("parentId", parentId);
    params.set("cursor", cursor);

    try {
      const response = await fetch(`/api/resources?${params.toString()}`, {
        signal: controller.signal,
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(String(response.status));
      const data: unknown = await response.json();
      if (!isListing(data)) throw new Error("invalid listing");
      if (generation.current !== current) return;
      setListing((previous) => {
        if (!previous) return data;
        return {
          items: mergeItems(previous.items, data.items),
          breadcrumbs: data.breadcrumbs.length ? data.breadcrumbs : previous.breadcrumbs,
          nextCursor: data.nextCursor,
        };
      });
    } catch {
      if (controller.signal.aborted || generation.current !== current) return;
      setMoreError("加载更多失败，请重试。");
    } finally {
      if (generation.current === current) setLoadingMore(false);
    }
  }, [listing, loadingMore, parentId]);

  const breadcrumbs = listing?.breadcrumbs ?? [];

  return (
    <div className={styles.browser}>
      <nav aria-label="资源路径" className={styles.crumbNav}>
        <ol className={styles.crumbs}>
          <li className={styles.crumb}>
            <Link
              href={folderHref(null)}
              className={styles.crumbLink}
              aria-current={status === "ready" && breadcrumbs.length === 0 ? "page" : undefined}
            >
              全部资源
            </Link>
          </li>
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.id} className={styles.crumb}>
              <ChevronRight aria-hidden="true" className={styles.crumbChevron} />
              {index === breadcrumbs.length - 1 ? (
                <span className={styles.current} aria-current="page">
                  {crumb.name}
                </span>
              ) : (
                <Link href={folderHref(crumb.id)} className={styles.crumbLink}>
                  {crumb.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {status === "loading" ? (
        <p role="status" className={styles.notice}>
          <LoaderCircle aria-hidden="true" className={styles.spinner} />
          正在加载资源…
        </p>
      ) : null}

      {status === "error" ? (
        <div role="alert" className={styles.error}>
          <p>{errorMessage}</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className={styles.retry}>
            <RefreshCw aria-hidden="true" />
            重新加载
          </button>
        </div>
      ) : null}

      {status === "ready" && listing ? (
        listing.items.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {breadcrumbs.length ? "这个文件夹还是空的" : "资源库还没有内容"}
            </p>
            <p>已发布的文件夹、视频、模型、图片和文件会显示在这里。</p>
          </div>
        ) : (
          <>
            <ul className={styles.list} aria-label="资源条目">
              {listing.items.map((item) => {
                const size = formatSize(item.size);
                return (
                  <li key={item.id} className={styles.row}>
                    <span className={styles.icon}>{kindIcon(item.kind)}</span>
                    <div className={styles.copy}>
                      <h2 className={styles.name}>
                        {item.kind === "folder" ? (
                          <Link href={folderHref(item.id)} className={styles.nameLink}>
                            {item.name}
                            <ChevronRight aria-hidden="true" className={styles.inlineChevron} />
                          </Link>
                        ) : (
                          <Link href={`/resources/${encodeURIComponent(item.id)}`} className={styles.nameLink}>
                            {item.name}
                          </Link>
                        )}
                      </h2>
                      {item.description ? <p className={styles.description}>{item.description}</p> : null}
                      <p className={styles.meta}>
                        <span>{KIND_LABELS[item.kind]}</span>
                        {size ? <span>{size}</span> : null}
                        {item.visibility === "private" ? <span className={styles.private}>仅登录可见</span> : null}
                      </p>
                    </div>
                    {DOWNLOADABLE[item.kind] ? (
                      <a
                        href={`/api/resources/${encodeURIComponent(item.id)}/download`}
                        className={styles.download}
                        aria-label={`下载 ${item.name}`}
                      >
                        <Download aria-hidden="true" />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className={styles.pagination}>
              <p role="status" aria-live="polite" className={styles.count}>
                已加载 {listing.items.length} 项
                {loadingMore ? "，正在加载更多…" : ""}
              </p>
              {moreError ? (
                <p role="alert" className={styles.moreError}>
                  {moreError}
                </p>
              ) : null}
              {listing.nextCursor ? (
                <button type="button" onClick={loadMore} disabled={loadingMore} className={styles.moreButton}>
                  {loadingMore ? <LoaderCircle aria-hidden="true" className={styles.spinner} /> : null}
                  {loadingMore ? "加载中…" : "加载更多"}
                </button>
              ) : null}
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
