import type { UploadItem } from "@/lib/types";

export async function uploadImage(file: File): Promise<UploadItem> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as UploadItem & { error?: string };
  if (res.status === 401) throw new Error("登录已失效，请重新登录后再上传");
  if (!res.ok) throw new Error(data.error ?? "上传失败");
  return data;
}

export function imageFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
}
