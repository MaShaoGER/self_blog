"use server";

import { revalidatePath } from "next/cache";
import { addComment } from "@/lib/comments";
import { hashIp } from "@/lib/crypto";
import { getLivePost } from "@/lib/posts";
import { hit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { getSettings } from "@/lib/settings";

export type CommentField = "author" | "website" | "body";

export type CommentFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Partial<Record<CommentField, string>>;
  /** Echo back what the visitor typed so a failed submit doesn't wipe the form. */
  values?: { author: string; website: string; body: string };
  /** Changes on each success so the client can reset the form. */
  nonce?: number;
};

const AUTHOR_MAX = 40;
const BODY_MAX = 2000;

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function normaliseUrl(input: string): string | null {
  if (!input) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function submitComment(slug: string, _prev: CommentFormState, fd: FormData): Promise<CommentFormState> {
  const author = str(fd, "author").trim();
  const websiteRaw = str(fd, "website").trim();
  const body = str(fd, "body").replace(/\r\n/g, "\n").trim();
  const values = { author, website: websiteRaw, body };

  // Honeypot: humans never see this field. Pretend success so bots learn nothing.
  if (str(fd, "company")) {
    return { status: "success", message: "已提交，审核后显示", nonce: Date.now() };
  }

  const errors: CommentFormState["errors"] = {};
  if (!author) errors.author = "请填写昵称";
  else if ([...author].length > AUTHOR_MAX) errors.author = `昵称最多 ${AUTHOR_MAX} 个字`;

  const website = normaliseUrl(websiteRaw);
  if (website === null) errors.website = "网址需以 http:// 或 https:// 开头";
  else if (website.length > 200) errors.website = "网址太长了";

  if (!body) errors.body = "请写点什么再提交";
  else if ([...body].length > BODY_MAX) errors.body = `评论最多 ${BODY_MAX} 字，现在是 ${[...body].length} 字`;

  if (Object.keys(errors).length) return { status: "error", errors, values };

  const post = await getLivePost(slug);
  if (!post) return { status: "error", message: "这篇文章暂时不能评论", values };

  const ip = await clientIp();
  const limit = hit(`comment:${ip}`, 5, 10 * 60 * 1000);
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfter / 60));
    return { status: "error", message: `提交太频繁了，请 ${minutes} 分钟后再试`, values };
  }

  const settings = await getSettings();
  const status = settings.commentsAutoApprove ? "approved" : "pending";

  await addComment({
    postSlug: post.slug,
    author,
    website: website || undefined,
    body,
    status,
    ipHash: hashIp(ip),
  });

  revalidatePath(`/posts/${post.slug}`);
  return {
    status: "success",
    message: status === "approved" ? "已发布" : "已提交，审核后显示",
    nonce: Date.now(),
  };
}
