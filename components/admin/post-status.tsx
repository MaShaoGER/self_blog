import type { PostMeta } from "@/lib/types";
import { StatusTag } from "./status-tag";

export type EffectiveStatus = "draft" | "published" | "scheduled";

/** 定时文章到点后在前台已可见，后台按"已发布"显示。 */
export function effectiveStatus(p: Pick<PostMeta, "status" | "date">, now = Date.now()): EffectiveStatus {
  if (p.status === "draft") return "draft";
  if (p.status === "scheduled" && new Date(p.date).getTime() > now) return "scheduled";
  return "published";
}

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  draft: "草稿",
  published: "已发布",
  scheduled: "定时",
};

export function PostStatusTag({ status }: { status: EffectiveStatus }) {
  const tone = status === "published" ? "green" : status === "scheduled" ? "accent" : "faint";
  return <StatusTag tone={tone}>{STATUS_LABEL[status]}</StatusTag>;
}

/** 前台文章地址。 */
export function postHref(slug: string) {
  return `/posts/${slug}`;
}
