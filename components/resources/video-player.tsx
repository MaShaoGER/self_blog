"use client";

import { useEffect, useRef, useState } from "react";
import type { DirectFormat, ResourceSource } from "@/shared/resource-types";
import styles from "./video-player.module.css";

const HLS_MIME = "application/vnd.apple.mpegurl";

type HlsErrorData = {
  fatal?: boolean;
  type?: string;
  details?: string;
  response?: { code?: number };
};

type HlsInstance = {
  loadSource: (url: string) => void;
  attachMedia: (media: HTMLMediaElement) => void;
  destroy: () => void;
  on: (event: string, callback: (event: string, data: HlsErrorData) => void) => void;
};

type HlsConstructor = {
  new (config?: { enableWorker?: boolean }): HlsInstance;
  Events: { ERROR: string; MANIFEST_PARSED: string };
  isSupported: () => boolean;
};

type DirectIssue = { kind: "expired" | "error"; message: string };

type PlaybackState = {
  key: string;
  phase: "loading" | "ready" | "error";
  message?: string;
  retryable?: boolean;
};

function isSafeDirectUrl(value: string): boolean {
  if (value.startsWith("/uploads/")) {
    return !value.includes("..") && !value.includes("\\");
  }
  if (!/^https:\/\//i.test(value)) return false;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;

    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host === "[::1]") {
      return false;
    }
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;

    return true;
  } catch {
    return false;
  }
}

function checkDirect(
  format: DirectFormat | undefined,
  url: string,
  expiresAt: string | undefined,
): DirectIssue | null {
  if (expiresAt) {
    const expires = Date.parse(expiresAt);
    if (Number.isNaN(expires)) {
      return { kind: "error", message: "播放链接的过期时间无法识别，已停止加载以保护访问权限。" };
    }
    if (expires <= Date.now()) {
      return {
        kind: "expired",
        message:
          "访问链接已过期，播放器没有开始加载。请联系发布者更新临时链接；刷新不会自动续签。",
      };
    }
  }

  if (format === "glb") {
    return { kind: "error", message: "这个资源是三维模型（GLB），不是视频，请使用模型预览。" };
  }
  if (format === undefined) {
    return { kind: "error", message: "资源没有标注视频格式（mp4 / webm / hls），已停止加载。" };
  }
  if (format !== "mp4" && format !== "webm" && format !== "hls") {
    return {
      kind: "error",
      message: `暂不支持这种视频格式（${String(format).slice(0, 16)}）。`,
    };
  }
  if (!isSafeDirectUrl(url)) {
    return { kind: "error", message: "播放地址无效或不是 HTTPS 链接，已阻止加载。" };
  }

  return null;
}

function checkEmbed(provider: string, videoId: string): DirectIssue | null {
  if (provider !== "youtube" && provider !== "bilibili") {
    return { kind: "error", message: "外部视频来源无效，已阻止加载播放器。" };
  }

  const pattern =
    provider === "youtube"
      ? /^[A-Za-z0-9_-]{11}$/
      : /^(?:BV[0-9A-Za-z]{10}|av[0-9]{1,12})$/;
  if (!pattern.test(videoId)) {
    return { kind: "error", message: "外部视频 ID 无效，已阻止加载播放器。" };
  }

  return null;
}

function embedUrls(provider: "youtube" | "bilibili", videoId: string) {
  if (provider === "youtube") {
    const id = encodeURIComponent(videoId);
    return {
      embed: `https://www.youtube.com/embed/${id}`,
      original: `https://www.youtube.com/watch?v=${id}`,
      label: "YouTube",
    };
  }

  if (videoId.startsWith("av")) {
    const aid = videoId.slice(2);
    return {
      embed: `https://player.bilibili.com/player.html?aid=${aid}&autoplay=0`,
      original: `https://www.bilibili.com/video/${encodeURIComponent(videoId)}`,
      label: "哔哩哔哩",
    };
  }

  const id = encodeURIComponent(videoId);
  return {
    embed: `https://player.bilibili.com/player.html?bvid=${id}&autoplay=0`,
    original: `https://www.bilibili.com/video/${id}`,
    label: "哔哩哔哩",
  };
}

function describeMediaError(video: HTMLVideoElement): string {
  switch (video.error?.code) {
    case 2:
      return "网络错误：链接可能已过期、跨域（CORS）受限或网络中断。请重试。";
    case 3:
      return "解码失败：视频编码可能损坏或不受浏览器支持。";
    case 4:
      return "无法播放：链接可能已过期或无权限，也可能是编码不受浏览器支持。";
    default:
      return "视频加载失败。可能是链接已过期、跨域限制（CORS）或编码不受浏览器支持。";
  }
}

function describeHlsError(data: HlsErrorData): string {
  const status = data.response?.code;

  if (status === 401 || status === 403 || status === 410) {
    return `访问链接已过期或无权限（HTTP ${status}）。请联系发布者更新临时链接；刷新不会自动续签。`;
  }
  if (status === 404) {
    return "视频清单不存在（HTTP 404），链接可能已失效。";
  }
  if (data.details === "manifestParsingError") {
    return "播放清单解析失败：服务端可能返回了错误页面，或链接已经过期。";
  }
  if (data.type === "networkError") {
    if (data.details === "manifestLoadError") {
      return "无法载入播放清单：链接可能已过期，或服务端跨域（CORS）设置阻止了浏览器。";
    }
    if (data.details === "levelLoadError" || data.details === "fragLoadError") {
      return "视频分片加载失败：可能是链接已过期、跨域限制（CORS）或网络中断。";
    }
    return "HLS 网络错误：可能是链接已过期、跨域限制（CORS）或网络中断。";
  }
  if (data.type === "mediaError") {
    return "HLS 解码失败：视频编码可能不受浏览器支持，或分片数据损坏。";
  }

  return "HLS 播放失败。可能是链接已过期、跨域限制（CORS）或编码不受支持。";
}

function StageNotice({ label, text }: { label: string; text: string }) {
  return (
    <div className={styles.stageNotice} aria-hidden="true">
      <span className={styles.noticeLabel}>{label}</span>
      <span className={styles.noticeText}>{text}</span>
    </div>
  );
}

export function VideoPlayer({ source, title }: { source: ResourceSource; title: string }) {
  const directSource = source.type === "direct" ? source : null;
  const embedSource = source.type === "embed" ? source : null;
  const isDirectSource = directSource !== null;

  const directUrl = directSource?.url ?? "";
  const directFormat = directSource?.format;
  const directExpiresAt = directSource?.expiresAt;
  const embedProvider = embedSource?.provider;
  const embedVideoId = embedSource?.videoId;

  const sourceKey = directSource
    ? `direct:${directUrl}:${directFormat ?? ""}:${directExpiresAt ?? ""}`
    : `embed:${embedProvider ?? ""}:${embedVideoId ?? ""}`;
  const consentKey = `${embedProvider ?? ""}:${embedVideoId ?? ""}`;

  const [state, setState] = useState<PlaybackState>({ key: "", phase: "loading" });
  const [consentedKey, setConsentedKey] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef(0);

  const activeState: PlaybackState =
    state.key === sourceKey ? state : { key: sourceKey, phase: "loading" };

  const directIssue = directSource
    ? checkDirect(directSource.format, directSource.url, directSource.expiresAt)
    : null;
  const embedIssue = embedSource ? checkEmbed(embedSource.provider, embedSource.videoId) : null;
  const embedInfo = embedSource && !embedIssue ? embedUrls(embedSource.provider, embedSource.videoId) : null;
  const consented = embedInfo !== null && consentedKey === consentKey;
  const displayTitle = title.trim() || "视频";

  const view = directSource
    ? (directIssue?.kind ?? activeState.phase)
    : embedSource
      ? embedIssue
        ? "error"
        : consented
          ? activeState.phase
          : "consent"
      : "error";

  const errorMessage =
    directIssue?.message ??
    embedIssue?.message ??
    (activeState.phase === "error" ? activeState.message : undefined) ??
    "播放失败。";

  const canRetry =
    view === "error" &&
    !embedInfo &&
    !directIssue &&
    !embedIssue &&
    activeState.phase === "error" &&
    activeState.retryable === true;

  const fallbackHref =
    view === "error" && directSource && !directIssue && isSafeDirectUrl(directSource.url)
      ? directSource.url
      : null;

  const statusText =
    view === "expired"
      ? "链接已过期"
      : view === "error"
        ? "播放失败"
        : view === "consent"
          ? "等待确认外部连接"
          : view === "ready"
            ? embedInfo ? "播放器页面已载入，播放状态以平台为准" : "已就绪"
            : embedInfo
              ? `正在连接 ${embedInfo.label}…`
              : "正在载入视频…";

  const badge = directSource
    ? (directFormat?.toUpperCase() ?? "VIDEO")
    : embedInfo
      ? embedInfo.label.toUpperCase()
      : "MEDIA";

  useEffect(() => {
    if (!isDirectSource) return;

    const issue = checkDirect(directFormat, directUrl, directExpiresAt);
    if (issue) return;

    const video = videoRef.current;
    if (!video) return;

    const session = ++sessionRef.current;
    let cancelled = false;
    let hlsInstance: HlsInstance | null = null;
    let hlsManaged = false;
    let hlsFailed = false;

    const current = () => !cancelled && sessionRef.current === session;
    const markReady = () => {
      if (current() && !hlsFailed) {
        setState({ key: sourceKey, phase: "ready" });
      }
    };
    const handleVideoError = () => {
      if (!current() || hlsManaged) return;
      setState({
        key: sourceKey,
        phase: "error",
        message: describeMediaError(video),
        retryable: true,
      });
    };

    setState({ key: sourceKey, phase: "loading" });

    video.addEventListener("loadedmetadata", markReady);
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    video.addEventListener("playing", markReady);
    video.addEventListener("error", handleVideoError);

    async function startHls(media: HTMLVideoElement) {
      try {
        const hlsModule = (await import("hls.js")) as unknown as { default: HlsConstructor };
        if (!current()) return;

        const Hls = hlsModule.default;
        if (!Hls.isSupported()) {
          hlsFailed = true;
          setState({
            key: sourceKey,
            phase: "error",
            message: "当前浏览器不支持 HLS（m3u8）播放，请换用 Safari 或更新浏览器。",
            retryable: false,
          });
          return;
        }

        // 关闭 Worker，避免额外的 CSP 与跨域要求。
        const instance = new Hls({ enableWorker: false });
        if (!current()) {
          instance.destroy();
          return;
        }

        hlsInstance = instance;
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (!current() || !data.fatal) return;
          hlsFailed = true;
          setState({
            key: sourceKey,
            phase: "error",
            message: describeHlsError(data),
            retryable: true,
          });
          instance.destroy();
          hlsInstance = null;
        });
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (current() && !hlsFailed) setState({ key: sourceKey, phase: "ready" });
        });
        instance.loadSource(directUrl);
        instance.attachMedia(media);
      } catch {
        if (!current()) return;
        hlsFailed = true;
        if (hlsInstance) {
          hlsInstance.destroy();
          hlsInstance = null;
        }
        setState({
          key: sourceKey,
          phase: "error",
          message: "HLS 播放组件加载失败，无法初始化播放器。请重试。",
          retryable: true,
        });
      }
    }

    const nativeHls =
      directFormat === "hls" &&
      (video.canPlayType(HLS_MIME) !== "" || video.canPlayType("application/x-mpegURL") !== "");

    if (directFormat === "hls" && !nativeHls) {
      hlsManaged = true;
      void startHls(video);
    } else {
      video.src = directUrl;
      video.load();
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", markReady);
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
      video.removeEventListener("playing", markReady);
      video.removeEventListener("error", handleVideoError);

      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [isDirectSource, directUrl, directFormat, directExpiresAt, sourceKey, generation]);

  function retry() {
    setState({ key: sourceKey, phase: "loading" });
    setGeneration((value) => value + 1);
  }

  function allowEmbed() {
    setConsentedKey(consentKey);
    setState({ key: sourceKey, phase: "loading" });
  }

  return (
    <figure className={styles.figure}>
      <div className={styles.stage}>
        {directSource && !directIssue && (
          <video
            ref={videoRef}
            className={styles.video}
            controls
            playsInline
            preload="metadata"
            title={displayTitle}
            aria-label={displayTitle}
          />
        )}

        {directSource && directIssue && (
          <StageNotice
            label={directIssue.kind === "expired" ? "EXPIRED" : "UNAVAILABLE"}
            text={directIssue.kind === "expired" ? "访问链接已过期" : "该来源无法作为视频播放"}
          />
        )}

        {embedSource && embedIssue && <StageNotice label="UNAVAILABLE" text="外部播放器来源无效" />}

        {embedSource && !embedIssue && !consented && embedInfo && (
          <button type="button" className={styles.consent} onClick={allowEmbed}>
            <span className={styles.consentKicker}>{embedInfo.label} / EXTERNAL VIDEO</span>
            <span className={styles.consentTitle}>{displayTitle}</span>
            <span className={styles.consentText}>
              点击后才会连接 {embedInfo.label} 的播放器。该平台可能获取你的 IP 与浏览器信息，并设置其
              Cookie。不会自动播放。
            </span>
            <span className={styles.consentCta}>载入播放器</span>
          </button>
        )}

        {embedSource && !embedIssue && consented && embedInfo && (
          <iframe
            key={`${embedInfo.embed}:${generation}`}
            className={styles.iframe}
            src={embedInfo.embed}
            title={`${displayTitle}（${embedInfo.label} 播放器）`}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            onLoad={() => setState({ key: sourceKey, phase: "ready" })}
            onError={() =>
              setState({
                key: sourceKey,
                phase: "error",
                message: "外部播放器加载失败。可能是网络限制、隐私插件拦截，或源站拒绝嵌入。",
                retryable: true,
              })
            }
          />
        )}
      </div>

      <div className={styles.meta}>
        <p className={styles.status} role="status" aria-live="polite">
          {statusText}
        </p>
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      </div>

      {embedInfo && consented && (
        <div className={styles.errorActions}>
          <button type="button" className={styles.retry} onClick={retry}>重新载入播放器</button>
          <a href={embedInfo.original} target="_blank" rel="noreferrer noopener" className={styles.retry}>在平台打开</a>
        </div>
      )}

      {(view === "error" || view === "expired") && (
        <div className={styles.error} role="alert">
          <p className={styles.errorText}>{errorMessage}</p>
          {(canRetry || fallbackHref) && (
            <div className={styles.errorActions}>
              {canRetry && (
                <button type="button" className={styles.retry} onClick={retry}>
                  重试
                </button>
              )}
              {fallbackHref && (
                <p className={styles.fallback}>
                  播放失败可尝试在源站打开{" "}
                  <a href={fallbackHref} target="_blank" rel="noreferrer noopener">
                    在源站打开
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
