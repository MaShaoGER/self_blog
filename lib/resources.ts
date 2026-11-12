import path from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR } from "./env";
import { readJson, updateJson } from "./store";
import {
  ResourceValidationError,
  isResourceId,
  isValidIsoDate,
  validateResourceInput,
} from "../shared/resource-validation";
import type {
  ResourceInput,
  ResourceListing,
  ResourceRecord,
  ResourceSource,
  ResourceSummary,
} from "../shared/resource-types";

const FILE = path.join(DATA_DIR, "resources.json");
const MAX_RECORDS = 5000;
const MAX_DEPTH = 32;
const PAGE_SIZE = 50;
const ACCESS_PURPOSES = new Set(["preview", "download"]);

export { ResourceValidationError };

export class ResourcesDataError extends Error {
  constructor() {
    super("资源数据无法读取，请检查 resources.json 的格式后重试；现有文件未改动。");
    this.name = "ResourcesDataError";
  }
}

/** Access failures carry the HTTP status the route handler should return. */
export class ResourceAccessError extends Error {
  readonly status: 400 | 404 | 410;

  constructor(status: 400 | 404 | 410, message: string) {
    super(message);
    this.name = "ResourceAccessError";
    this.status = status;
  }
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compare(a: ResourceRecord, b: ResourceRecord): number {
  const folder = Number(b.kind === "folder") - Number(a.kind === "folder");
  return folder || a.name.localeCompare(b.name, "zh-Hans-CN") || a.id.localeCompare(b.id);
}

function byId(records: ResourceRecord[]): Map<string, ResourceRecord> {
  return new Map(records.map((record) => [record.id, record]));
}

function childrenByParent(records: ResourceRecord[]): Map<string, ResourceRecord[]> {
  const map = new Map<string, ResourceRecord[]>();
  for (const record of records) {
    if (record.parentId === null) continue;
    const children = map.get(record.parentId);
    if (children) children.push(record);
    else map.set(record.parentId, [record]);
  }
  return map;
}

/** Reject corrupt files rather than silently dropping records or rewriting them. */
function validateRecords(raw: unknown): ResourceRecord[] {
  if (!Array.isArray(raw) || raw.length > MAX_RECORDS) throw new ResourcesDataError();
  const records: ResourceRecord[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (!plainObject(item)) throw new ResourcesDataError();
    const id = item.id;
    const createdAt = item.createdAt;
    const updatedAt = item.updatedAt;
    if (!isResourceId(id) || ids.has(id)) throw new ResourcesDataError();
    if (!isValidIsoDate(createdAt) || !isValidIsoDate(updatedAt)) throw new ResourcesDataError();
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = item;
    let value: ResourceInput;
    try {
      value = validateResourceInput(payload);
    } catch {
      throw new ResourcesDataError();
    }
    ids.add(id);
    records.push({ ...value, id, createdAt, updatedAt });
  }

  const lookup = byId(records);
  for (const record of records) {
    const seen = new Set<string>();
    let current = record;
    let depth = 0;
    while (current.parentId !== null) {
      if (seen.has(current.id)) throw new ResourcesDataError();
      seen.add(current.id);
      const parent = lookup.get(current.parentId);
      if (!parent || parent.kind !== "folder") throw new ResourcesDataError();
      depth += 1;
      if (depth + 1 > MAX_DEPTH) throw new ResourcesDataError();
      current = parent;
    }
  }
  return records.sort(compare);
}

async function loadRecords(): Promise<ResourceRecord[]> {
  let raw: unknown;
  try {
    raw = await readJson<unknown>(FILE, []);
  } catch {
    throw new ResourcesDataError();
  }
  return validateRecords(raw);
}

function mutate<T>(fn: (records: ResourceRecord[]) => T): Promise<T> {
  return updateJson<unknown, T>(FILE, [], (raw) => {
    const records = validateRecords(raw);
    const result = fn(records);
    return { value: records, result };
  }).catch((error) => {
    if (error instanceof ResourcesDataError) throw error;
    if (error instanceof SyntaxError) throw new ResourcesDataError();
    throw error;
  });
}

function findIndex(records: ResourceRecord[], id: string): number {
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) throw new ResourceValidationError("id", "资源已被删除，请刷新列表后重试");
  return index;
}

/** Immediate parent first. Rejects missing parents, non-folders, self-reference and cycles. */
function parentChain(records: ResourceRecord[], parentId: string | null, selfId?: string): ResourceRecord[] {
  const lookup = byId(records);
  const seen = new Set<string>();
  const chain: ResourceRecord[] = [];
  let currentId = parentId;
  while (currentId !== null) {
    if (currentId === selfId || seen.has(currentId)) {
      throw new ResourceValidationError("parentId", "上级文件夹不能是自身或其子文件夹");
    }
    seen.add(currentId);
    const parent = lookup.get(currentId);
    if (!parent) throw new ResourceValidationError("parentId", "上级文件夹不存在");
    if (parent.kind !== "folder") throw new ResourceValidationError("parentId", "上级必须是文件夹");
    chain.push(parent);
    if (chain.length + 1 > MAX_DEPTH) {
      throw new ResourceValidationError("parentId", `文件夹层级不能超过 ${MAX_DEPTH} 层`);
    }
    currentId = parent.parentId;
  }
  return chain;
}

function descendantDepth(records: ResourceRecord[], id: string): number {
  const map = childrenByParent(records);
  const stack: { id: string; depth: number }[] = [{ id, depth: 0 }];
  const seen = new Set<string>();
  let deepest = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current.id)) throw new ResourcesDataError();
    seen.add(current.id);
    if (current.depth > deepest) deepest = current.depth;
    for (const child of map.get(current.id) ?? []) stack.push({ id: child.id, depth: current.depth + 1 });
  }
  return deepest;
}

function isVisible(records: ResourceRecord[], record: ResourceRecord): boolean {
  if (record.visibility !== "public") return false;
  const lookup = byId(records);
  const seen = new Set<string>();
  let current = record;
  while (current.parentId !== null) {
    if (seen.has(current.id)) return false;
    seen.add(current.id);
    const parent = lookup.get(current.parentId);
    if (!parent || parent.visibility !== "public") return false;
    current = parent;
  }
  return true;
}

function breadcrumbTrail(records: ResourceRecord[], parentId: string | null): { id: string; name: string }[] {
  if (parentId === null) return [];
  const lookup = byId(records);
  const trail: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  let current = lookup.get(parentId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift({ id: current.id, name: current.name });
    current = current.parentId === null ? undefined : lookup.get(current.parentId);
  }
  return trail;
}

function parseCursor(cursor: string | undefined): number {
  if (cursor === undefined || cursor === "") return 0;
  if (!/^\d+$/.test(cursor)) throw new ResourceValidationError("cursor", "翻页游标格式不正确");
  const offset = Number(cursor);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new ResourceValidationError("cursor", "翻页游标格式不正确");
  return offset;
}

export async function listResourcesForAdmin(): Promise<ResourceRecord[]> {
  return loadRecords();
}

export async function createResource(input: unknown): Promise<ResourceRecord> {
  const value = validateResourceInput(input);
  return mutate((records) => {
    if (records.length >= MAX_RECORDS) {
      throw new ResourceValidationError("name", `资源数量不能超过 ${MAX_RECORDS} 条`);
    }
    parentChain(records, value.parentId);
    const now = new Date().toISOString();
    const record: ResourceRecord = { ...value, id: randomUUID(), createdAt: now, updatedAt: now };
    records.push(record);
    return record;
  });
}

export async function updateResource(id: string, input: unknown): Promise<ResourceRecord> {
  const value = validateResourceInput(input);
  return mutate((records) => {
    const index = findIndex(records, id);
    const existing = records[index];
    const chain = parentChain(records, value.parentId, existing.id);
    if (chain.length + 1 + descendantDepth(records, existing.id) > MAX_DEPTH) {
      throw new ResourceValidationError("parentId", `文件夹层级不能超过 ${MAX_DEPTH} 层`);
    }
    if (value.kind !== "folder" && records.some((record) => record.parentId === existing.id)) {
      throw new ResourceValidationError("kind", "该文件夹下还有内容，不能改为其他类型");
    }
    const next: ResourceRecord = {
      ...value,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    records[index] = next;
    return next;
  });
}

/** Removes the index entries only; remotely stored files are never touched here. */
export async function deleteResource(id: string): Promise<void> {
  return mutate((records) => {
    findIndex(records, id);
    const map = childrenByParent(records);
    const stack = [id];
    const removed = new Set<string>();
    while (stack.length) {
      const current = stack.pop()!;
      if (removed.has(current)) continue;
      removed.add(current);
      for (const child of map.get(current) ?? []) stack.push(child.id);
    }
    for (let index = records.length - 1; index >= 0; index -= 1) {
      if (removed.has(records[index].id)) records.splice(index, 1);
    }
  });
}

export async function getResource(id: string, includePrivate = false): Promise<ResourceRecord | null> {
  if (!isResourceId(id)) return null;
  const records = await loadRecords();
  const record = records.find((item) => item.id === id);
  if (!record) return null;
  if (!includePrivate && !isVisible(records, record)) return null;
  return record;
}

export async function listResourceChildren(
  parentId: string | null,
  includePrivate: boolean,
  cursor?: string,
): Promise<ResourceListing> {
  const offset = parseCursor(cursor);
  if (parentId !== null && !isResourceId(parentId)) {
    throw new ResourceValidationError("parentId", "上级文件夹不存在");
  }
  const records = await loadRecords();
  if (parentId !== null) {
    const parent = records.find((record) => record.id === parentId);
    if (!parent || parent.kind !== "folder" || (!includePrivate && !isVisible(records, parent))) {
      throw new ResourceValidationError("parentId", "上级文件夹不存在或不可见");
    }
  }
  const children = records
    .filter(
      (record) =>
        record.parentId === parentId &&
        (includePrivate || (record.visibility === "public" && record.listed !== false)),
    )
    .sort(compare);
  const page = children.slice(offset, offset + PAGE_SIZE);
  return {
    items: page.map(({ source: _source, ...summary }) => summary as ResourceSummary),
    breadcrumbs: breadcrumbTrail(records, parentId),
    nextCursor: offset + PAGE_SIZE < children.length ? String(offset + PAGE_SIZE) : null,
  };
}

/** Deduplicated HTTPS origins, including private resources. Never returns full URLs. */
export async function getResourceOrigins(): Promise<string[]> {
  const records = await loadRecords();
  const origins = new Set<string>();
  for (const record of records) {
    const source = record.source;
    if (!source || source.type !== "direct") continue;
    try {
      const url = new URL(source.url);
      if (url.protocol === "https:") origins.add(url.origin);
    } catch {
      // Same-origin /uploads paths have no external origin.
    }
  }
  return [...origins].sort();
}

/**
 * Bytes of an uploaded video stay protected by the catalogue: a URL is readable only while
 * at least one record still points at it and that record passes the existing visibility rules.
 * `includePrivate` is the signed-in staff view; anonymous callers only get public, visible records.
 */
export async function canAccessStoredVideo(url: string, includePrivate: boolean): Promise<boolean> {
  const records = await loadRecords();
  return records.some((record) => {
    const source = record.source;
    if (!source || source.type !== "direct" || source.url !== url) return false;
    return includePrivate || isVisible(records, record);
  });
}

export async function resolveResourceAccess(
  id: string,
  includePrivate: boolean,
  purpose: "preview" | "download",
): Promise<ResourceSource> {
  if (!ACCESS_PURPOSES.has(purpose)) throw new ResourceAccessError(400, "访问用途不正确");
  if (!isResourceId(id)) throw new ResourceAccessError(404, "资源不存在或不可见");
  const records = await loadRecords();
  const record = records.find((item) => item.id === id);
  if (!record || (!includePrivate && !isVisible(records, record))) {
    throw new ResourceAccessError(404, "资源不存在或不可见");
  }
  if (record.kind === "folder" || !record.source) throw new ResourceAccessError(400, "该资源没有可访问的来源");
  if (purpose === "download" && record.source.type === "embed") {
    throw new ResourceAccessError(400, "嵌入式视频不支持直接下载");
  }
  if (record.source.type === "direct" && record.source.expiresAt) {
    const expires = Date.parse(record.source.expiresAt);
    if (Number.isFinite(expires) && expires <= Date.now()) throw new ResourceAccessError(410, "资源链接已过期");
  }
  return { ...record.source };
}
