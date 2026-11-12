export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export type VideoLinkFormat = "mp4" | "webm" | "hls";
export type VideoInsertResult = { id: string; name: string; url?: string };
