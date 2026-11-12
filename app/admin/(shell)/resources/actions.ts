"use server";

import { revalidatePath } from "next/cache";
import { assertSession } from "@/lib/auth";
import {
  createResource,
  deleteResource,
  updateResource,
  ResourceValidationError,
  ResourcesDataError,
} from "@/lib/resources";
import type {
  DirectFormat,
  ResourceActionState,
  ResourceInput,
  ResourceKind,
  ResourceSource,
  ResourceVisibility,
} from "@/shared/resource-types";

const KINDS: readonly ResourceKind[] = ["folder", "video", "model", "image", "file"];
const VISIBILITIES: readonly ResourceVisibility[] = ["public", "private"];
const VIDEO_FORMATS: readonly DirectFormat[] = ["mp4", "webm", "hls"];
const PROVIDERS = ["youtube", "bilibili"] as const;

function scalar(form: FormData, key: string, optional = false): string {
  const values = form.getAll(key);
  if (values.length === 0 && optional) return "";
  if (values.length !== 1 || typeof values[0] !== "string") {
    throw new ResourceValidationError(key, "表单内容不完整，请刷新后重试");
  }
  return values[0].trim();
}

function required(form: FormData, key: string, message: string): string {
  const value = scalar(form, key, true);
  if (!value) throw new ResourceValidationError(key, message);
  return value;
}

function parseSource(form: FormData, kind: ResourceKind): ResourceSource {
  const sourceType = scalar(form, "sourceType", true) || "direct";

  if (sourceType === "direct") {
    const url = required(form, "url", "请填写资源地址");
    const expiresAt = scalar(form, "expiresAt", true);
    let format: DirectFormat | undefined;

    if (kind === "video") {
      const raw = scalar(form, "format", true);
      if (raw) {
        if (!VIDEO_FORMATS.includes(raw as DirectFormat)) {
          throw new ResourceValidationError("format", "视频格式只能是 MP4、WebM 或 HLS");
        }
        format = raw as DirectFormat;
      }
    } else if (kind === "model") {
      format = "glb";
    }

    return {
      type: "direct",
      url,
      ...(format ? { format } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    };
  }

  if (sourceType === "embed") {
    if (kind !== "video") {
      throw new ResourceValidationError("sourceType", "只有视频条目可以使用嵌入播放");
    }
    const provider = required(form, "provider", "请选择嵌入平台");
    if (!PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
      throw new ResourceValidationError("provider", "嵌入平台不受支持");
    }
    const videoId = required(form, "videoId", "请填写视频 ID");
    return {
      type: "embed",
      provider: provider as (typeof PROVIDERS)[number],
      videoId,
    };
  }

  throw new ResourceValidationError("sourceType", "来源类型不正确");
}

function parseInput(form: FormData): ResourceInput {
  const kind = scalar(form, "kind", true);
  if (!KINDS.includes(kind as ResourceKind)) {
    throw new ResourceValidationError("kind", "条目类型不正确");
  }
  const typedKind = kind as ResourceKind;

  const visibility = scalar(form, "visibility", true);
  if (!VISIBILITIES.includes(visibility as ResourceVisibility)) {
    throw new ResourceValidationError("visibility", "可见性不正确");
  }

  const parentRaw = scalar(form, "parentId", true);
  const base: ResourceInput = {
    name: required(form, "name", "请填写名称"),
    description: scalar(form, "description", true),
    kind: typedKind,
    parentId: parentRaw || null,
    visibility: visibility as ResourceVisibility,
    listed: form.get("listed") === "true",
  };

  if (typedKind === "folder") return base;

  const sizeRaw = scalar(form, "size", true);
  let size: number | undefined;
  if (sizeRaw) {
    if (!/^\d+$/.test(sizeRaw)) {
      throw new ResourceValidationError("size", "文件大小必须是非负整数（字节）");
    }
    size = Number(sizeRaw);
    if (!Number.isSafeInteger(size)) {
      throw new ResourceValidationError("size", "文件大小超出可记录范围");
    }
  }

  return {
    ...base,
    ...(size !== undefined ? { size } : {}),
    source: parseSource(form, typedKind),
  };
}

function failure(error: unknown): ResourceActionState {
  if (error instanceof ResourceValidationError) {
    return { status: "error", message: error.message, field: error.field };
  }
  if (error instanceof ResourcesDataError) {
    return { status: "error", message: error.message };
  }
  console.error("resource mutation failed");
  return { status: "error", message: "保存失败，请稍后重试" };
}

function refresh(id?: string) {
  revalidatePath("/admin/resources");
  revalidatePath("/resources");
  if (id) revalidatePath(`/resources/${id}`);
}

export async function createResourceAction(
  _previous: ResourceActionState,
  form: FormData,
): Promise<ResourceActionState> {
  await assertSession();
  let id: string | undefined;
  try {
    id = (await createResource(parseInput(form))).id;
  } catch (error) {
    return failure(error);
  }
  refresh(id);
  return { status: "success", message: "资源已添加，前台资源库已更新" };
}

export async function updateResourceAction(
  _previous: ResourceActionState,
  form: FormData,
): Promise<ResourceActionState> {
  await assertSession();
  let id: string | undefined;
  try {
    id = required(form, "id", "缺少要保存的资源");
    await updateResource(id, parseInput(form));
  } catch (error) {
    return failure(error);
  }
  refresh(id);
  return { status: "success", message: "资源已保存，前台展示已更新" };
}

export async function deleteResourceAction(id: string): Promise<void> {
  await assertSession();
  try {
    await deleteResource(id);
  } catch (error) {
    const state = failure(error);
    throw new Error(state.message ?? "删除失败，请稍后重试");
  }
  refresh(id);
}
