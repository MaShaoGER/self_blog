import type {
  DirectFormat,
  ResourceInput,
  ResourceKind,
  ResourceSource,
  ResourceVisibility,
} from "./resource-types";

/** Validation failure raised before any data file is touched. */
export class ResourceValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "ResourceValidationError";
    this.field = field;
  }
}

const KINDS: readonly ResourceKind[] = ["folder", "video", "model", "image", "file"];
const VISIBILITIES: readonly ResourceVisibility[] = ["public", "private"];
const VIDEO_FORMATS: readonly DirectFormat[] = ["mp4", "webm", "hls"];
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const INPUT_KEYS = new Set(["name", "description", "kind", "parentId", "visibility", "listed", "source", "size"]);
const DIRECT_KEYS = new Set(["type", "url", "format", "expiresAt"]);
const EMBED_KEYS = new Set(["type", "provider", "videoId"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const BILIBILI_ID = /^(?:BV[0-9A-Za-z]{10}|av\d{1,12})$/;

export function isResourceId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export function isValidIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    ISO_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: Set<string>, field?: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ResourceValidationError(field ?? key, "包含无法识别的字段");
  }
}

function scalar(value: unknown, field: string, label: string, max: number): string {
  if (value === undefined) return "";
  if (typeof value !== "string") throw new ResourceValidationError(field, `${label}格式不正确`);
  const result = value.trim();
  if (result.length > max) throw new ResourceValidationError(field, `${label}最多 ${max} 个字符`);
  return result;
}

function text(value: unknown, field: string, label: string, max: number): string {
  if (typeof value !== "string") throw new ResourceValidationError(field, `${label}格式不正确`);
  const result = value.trim();
  if (result.length > max) throw new ResourceValidationError(field, `${label}最多 ${max} 个字符`);
  return result;
}

function ipv4Parts(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every((part) => part <= 255) ? parts : null;
}

function isInternalIPv4(parts: number[]): boolean {
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  // Multicast, reserved and broadcast space.
  return a >= 224;
}

/** Expand a literal IPv6 address (without brackets) into eight 16-bit groups. */
function ipv6Groups(host: string): number[] | null {
  let value = host.toLowerCase();
  const embedded = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(value);
  if (embedded) {
    const parts = ipv4Parts(embedded[1]);
    if (!parts) return null;
    const high = ((parts[0] << 8) | parts[1]).toString(16);
    const low = ((parts[2] << 8) | parts[3]).toString(16);
    value = `${value.slice(0, -embedded[1].length)}${high}:${low}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (!part) return [];
    const groups = part.split(":");
    if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
    return groups.map((group) => parseInt(group, 16));
  };
  const left = parse(halves[0]);
  const right = halves.length === 2 ? parse(halves[1] ?? "") : [];
  if (!left || !right) return null;
  if (halves.length === 2) {
    const missing = 8 - left.length - right.length;
    if (missing < 1) return null;
    return [...left, ...new Array<number>(missing).fill(0), ...right];
  }
  return left.length === 8 ? left : null;
}

function embeddedIPv4(groups: number[]): number[] {
  return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
}

function isInternalIPv6(groups: number[]): boolean {
  const allZero = groups.every((group) => group === 0);
  if (allZero) return true;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true; // ::1
  if ((groups[0] & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // link local fe80::/10
  if ((groups[0] & 0xff00) === 0xff00) return true; // multicast ff00::/8
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true; // documentation
  if (groups[0] === 0x2002) return true; // 6to4 may embed internal IPv4
  const mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  const compatible = groups.slice(0, 6).every((group) => group === 0) && (groups[6] !== 0 || groups[7] !== 0);
  if (mapped || compatible) return isInternalIPv4(embeddedIPv4(groups));
  return false;
}

function hasTraversal(pathname: string): boolean {
  let value = pathname;
  for (let round = 0; round < 4; round += 1) {
    if (/(?:^|\/)\.\.?(?:\/|$)/.test(value)) return true;
    let decoded: string;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      return true;
    }
    if (decoded === value) return false;
    value = decoded;
  }
  return /(?:^|\/)\.\.?(?:\/|$)/.test(value);
}

function isRelativeAssetPath(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];
  if (!path.startsWith("/uploads/")) return false;
  if (path === "/uploads/") return false;
  return !hasTraversal(path);
}

/** Shared HTTPS / same-origin asset check. Internal hosts, credentials and traversal are rejected. */
export function isSafeResourceUrl(raw: string): boolean {
  if (!/^https:\/\//i.test(raw)) return isRelativeAssetPath(raw);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (host.startsWith("[") && host.endsWith("]")) {
    const groups = ipv6Groups(host.slice(1, -1));
    return groups !== null && !isInternalIPv6(groups);
  }
  const parts = ipv4Parts(host);
  if (parts) return !isInternalIPv4(parts);
  if (/^[\d.]+$/.test(host)) return false; // unusual numeric form the URL parser left alone
  return true;
}

function directFormat(kind: ResourceKind, url: string, format: unknown): DirectFormat | undefined {
  if (format !== undefined && typeof format !== "string") {
    throw new ResourceValidationError("source", "资源格式格式不正确");
  }
  if (kind === "image" || kind === "file") {
    if (format !== undefined) throw new ResourceValidationError("source", "图片与普通文件不需要指定媒体格式");
    return undefined;
  }
  const allowed = kind === "video" ? VIDEO_FORMATS : (["glb"] as const);
  if (format !== undefined) {
    if (!(allowed as readonly string[]).includes(format)) {
      throw new ResourceValidationError("source", kind === "video" ? "视频格式需为 mp4、webm 或 hls" : "模型直链需为 glb 格式");
    }
    return format as DirectFormat;
  }
  const pathname = url.split(/[?#]/, 1)[0].toLowerCase();
  if (kind === "video") {
    if (pathname.endsWith(".mp4")) return "mp4";
    if (pathname.endsWith(".webm")) return "webm";
    if (pathname.endsWith(".m3u8")) return "hls";
    throw new ResourceValidationError("source", "视频直链需为 mp4、webm 或 hls 格式");
  }
  if (pathname.endsWith(".glb")) return "glb";
  throw new ResourceValidationError("source", "模型直链需为 glb 格式");
}

function sourceValue(value: unknown, kind: ResourceKind): ResourceSource | undefined {
  if (kind === "folder") {
    if (value !== undefined) throw new ResourceValidationError("source", "文件夹不能包含资源来源");
    return undefined;
  }
  if (!plainObject(value)) throw new ResourceValidationError("source", "请提供资源来源");
  const record = value;
  const type = record.type;
  if (type === "embed") {
    rejectUnknownKeys(record, EMBED_KEYS, "source");
    if (kind !== "video") throw new ResourceValidationError("source", "只有视频可以使用嵌入式播放");
    const provider = record.provider;
    if (provider !== "youtube" && provider !== "bilibili") {
      throw new ResourceValidationError("source", "不支持的嵌入来源");
    }
    const videoId = record.videoId;
    const pattern = provider === "youtube" ? YOUTUBE_ID : BILIBILI_ID;
    if (typeof videoId !== "string" || !pattern.test(videoId)) {
      throw new ResourceValidationError("source", "视频编号格式不正确");
    }
    return { type: "embed", provider, videoId };
  }
  if (type !== "direct") throw new ResourceValidationError("source", "资源来源类型不正确");
  rejectUnknownKeys(record, DIRECT_KEYS, "source");
  const raw = record.url;
  if (typeof raw !== "string" || !raw.trim()) throw new ResourceValidationError("source", "请填写资源地址");
  const url = raw.trim();
  if (url.length > 8192) throw new ResourceValidationError("source", "资源地址过长");
  if (/[\u0000-\u001f\u007f\s\\]/.test(url)) throw new ResourceValidationError("source", "资源地址包含不允许的字符");
  if (!isSafeResourceUrl(url)) throw new ResourceValidationError("source", "资源地址必须是 https 链接，或站内 /uploads/ 路径");
  const format = directFormat(kind, url, record.format);
  let expiresAt: string | undefined;
  if (record.expiresAt !== undefined) {
    if (!isValidIsoDate(record.expiresAt)) throw new ResourceValidationError("source", "有效期需为 ISO 时间格式");
    expiresAt = new Date(record.expiresAt).toISOString();
  }
  return { type: "direct", url, format, expiresAt };
}

/** Validate and normalise an untrusted resource payload. Expired sources may be stored; access checks return 410. */
export function validateResourceInput(input: unknown): ResourceInput {
  if (!plainObject(input)) throw new ResourceValidationError("name", "资源内容格式不正确");
  rejectUnknownKeys(input, INPUT_KEYS);

  const name = text(input.name, "name", "资源名称", 120);
  if (!name) throw new ResourceValidationError("name", "请填写资源名称");
  const description = scalar(input.description, "description", "资源描述", 2000);

  const kind = input.kind;
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
    throw new ResourceValidationError("kind", "请选择有效的资源类型");
  }
  const visibility = input.visibility;
  if (typeof visibility !== "string" || !(VISIBILITIES as readonly string[]).includes(visibility)) {
    throw new ResourceValidationError("visibility", "请选择公开或私有");
  }

  let parentId: string | null = null;
  const rawParent = input.parentId;
  if (rawParent !== undefined && rawParent !== null) {
    if (!isResourceId(rawParent)) throw new ResourceValidationError("parentId", "上级文件夹格式不正确");
    parentId = rawParent;
  }

  let size: number | undefined;
  const rawSize = input.size;
  if (rawSize !== undefined) {
    if (typeof rawSize !== "number" || !Number.isSafeInteger(rawSize) || rawSize < 0) {
      throw new ResourceValidationError("size", "文件大小需为非负整数");
    }
    size = rawSize;
  }

  let listed: boolean | undefined;
  if (input.listed !== undefined) {
    if (typeof input.listed !== "boolean") throw new ResourceValidationError("listed", "目录显示设置格式不正确");
    listed = input.listed;
  }

  const source = sourceValue(input.source, kind as ResourceKind);
  return {
    name,
    description,
    kind: kind as ResourceKind,
    parentId,
    visibility: visibility as ResourceVisibility,
    ...(listed !== undefined ? { listed } : {}),
    ...(source ? { source } : {}),
    ...(size !== undefined ? { size } : {}),
  };
}
