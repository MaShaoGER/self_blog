import type { ResourceSource } from "./resource-types";
import { isSafeResourceUrl } from "./resource-validation";
import type { VideoLinkFormat } from "./video-types";

/**
 * Pure URL normalisation shared by the editor dialog and the upload API.
 * No network access, no Node built-ins: nothing is fetched or resolved remotely.
 */
export class VideoLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoLinkError";
  }
}

const MAX_URL_LENGTH = 8192;
const FORMATS: readonly VideoLinkFormat[] = ["mp4", "webm", "hls"];
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const BILIBILI_ID = /^(?:BV[0-9A-Za-z]{10}|av\d{1,12})$/;
const UPLOADED_VIDEO = /^\/uploads\/videos\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.(mp4|webm)$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const BILIBILI_HOSTS = new Set(["bilibili.com", "www.bilibili.com", "m.bilibili.com"]);

/** Canonical file name and format for a stored video URL, or null when the path is not one we serve. */
export function storedVideoFile(url: string): { name: string; format: "mp4" | "webm" } | null {
  const match = UPLOADED_VIDEO.exec(url);
  if (!match) return null;
  const format = match[2] as "mp4" | "webm";
  return { name: `${match[1].toLowerCase()}.${format}`, format };
}

function invalid(message: string): never {
  throw new VideoLinkError(message);
}

/** Reject dot-segments before URL parsing, since the parser would silently collapse them. */
function hasTraversal(raw: string): boolean {
  let value = (raw.split(/[?#]/, 1)[0] ?? "").replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "");
  for (let round = 0; round < 3; round += 1) {
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

function segmentsOf(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean);
}

function youtubeSource(url: URL): ResourceSource {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const segments = segmentsOf(url);
  let videoId: string | null = null;
  if (host === "youtu.be") {
    if (segments.length === 1 && YOUTUBE_ID.test(segments[0])) videoId = segments[0];
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === "/watch") {
      const values = url.searchParams.getAll("v");
      if (values.length === 1 && YOUTUBE_ID.test(values[0])) videoId = values[0];
    } else if (segments.length === 2 && (segments[0] === "shorts" || segments[0] === "embed") && YOUTUBE_ID.test(segments[1])) {
      videoId = segments[1];
    }
  }
  if (!videoId) invalid("请粘贴 YouTube 视频页面链接（watch、shorts 或 embed）");
  return { type: "embed", provider: "youtube", videoId };
}

function bilibiliSource(url: URL): ResourceSource {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "b23.tv") invalid("b23.tv 短链接无法解析，请复制完整视频页链接");
  let videoId: string | null = null;
  if (BILIBILI_HOSTS.has(host)) {
    const segments = segmentsOf(url);
    if (segments.length === 2 && segments[0] === "video" && BILIBILI_ID.test(segments[1])) videoId = segments[1];
  } else if (host === "player.bilibili.com" && url.pathname === "/player.html") {
    const bvid = url.searchParams.get("bvid");
    const aid = url.searchParams.get("aid");
    if (bvid !== null) {
      if (/^BV[0-9A-Za-z]{10}$/.test(bvid)) videoId = bvid;
    } else if (aid !== null && /^[1-9]\d{0,11}$/.test(aid)) {
      videoId = `av${aid}`;
    }
  }
  if (!videoId) invalid("请粘贴哔哩哔哩视频页面链接（bilibili.com/video 或官方播放器链接）");
  return { type: "embed", provider: "bilibili", videoId };
}

function platformSource(url: URL, format: VideoLinkFormat | undefined): ResourceSource | null {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const isYoutube = host === "youtu.be" || YOUTUBE_HOSTS.has(host);
  const isBilibili = host === "b23.tv" || BILIBILI_HOSTS.has(host) || host === "player.bilibili.com";
  if (!isYoutube && !isBilibili) return null;
  if (format !== undefined) invalid("视频网站链接不需要指定直链格式，请移除格式后重试");
  return isYoutube ? youtubeSource(url) : bilibiliSource(url);
}

function directSource(url: URL, format: VideoLinkFormat | undefined): ResourceSource {
  if (url.pathname === "/" || url.pathname === "") invalid("请填写完整的视频地址");
  const pathname = url.pathname.toLowerCase();
  const inferred = pathname.endsWith(".mp4")
    ? "mp4"
    : pathname.endsWith(".webm")
      ? "webm"
      : pathname.endsWith(".m3u8")
        ? "hls"
        : undefined;
  if (format !== undefined && inferred !== undefined && format !== inferred) {
    invalid("视频地址的扩展名与所选格式不一致，请检查后重试");
  }
  const resolved = format ?? inferred;
  if (!resolved) invalid("无法识别这个视频地址，请填写 mp4、webm 或 m3u8 直链，或指定视频格式");
  return { type: "direct", url: url.href, format: resolved };
}

/**
 * Turn a pasted link into a typed resource source.
 * YouTube/Bilibili pages become embeds; everything else must be an HTTPS direct link
 * (or one of our own stored videos) whose format is either inferred or supplied.
 */
export function parseVideoLink(input: string, format?: VideoLinkFormat): ResourceSource {
  if (typeof input !== "string") invalid("请粘贴视频链接");
  const raw = input.trim();
  if (!raw) invalid("请粘贴视频链接");
  if (raw.length > MAX_URL_LENGTH) invalid("视频地址过长");
  if (/[\u0000-\u001f\u007f\s\\]/.test(raw)) invalid("视频地址包含不允许的字符");
  if (format !== undefined && !(FORMATS as readonly string[]).includes(format)) {
    invalid("视频格式需为 mp4、webm 或 hls");
  }

  const uploaded = storedVideoFile(raw);
  if (uploaded) {
    const sourceFormat = uploaded.format;
    if (format !== undefined && format !== sourceFormat) invalid("视频地址的扩展名与所选格式不一致，请检查后重试");
    return { type: "direct", url: `/uploads/videos/${uploaded.name}`, format: sourceFormat };
  }
  if (raw.startsWith("/uploads/")) invalid("站内视频地址无效，请重新上传视频");
  if (hasTraversal(raw)) invalid("视频链接包含不允许的路径");
  if (!/^https:\/\//i.test(raw)) invalid("视频链接必须是 https 地址");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    invalid("视频地址格式不正确");
  }
  if (url.protocol !== "https:") invalid("视频链接必须是 https 地址");
  if (url.username || url.password) invalid("视频链接不能包含账号密码");
  if (!url.hostname) invalid("视频地址格式不正确");
  if (!isSafeResourceUrl(url.href)) invalid("视频链接不能指向本机、内网或保留地址");

  return platformSource(url, format) ?? directSource(url, format);
}
