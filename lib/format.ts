const TZ = "Asia/Shanghai";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replaceAll("/", ".");
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function isoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72)
    .replace(/^-|-$/g, "");
  if (base.length >= 3) return base;
  const stamp = new Date().toISOString().slice(0, 10);
  return `post-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/[>#|]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/([\u3400-\u9fff])\s+([，。！？、；：])/g, "$1$2")
    .trim();
}

export function excerptFrom(content: string, length = 150): string {
  const text = stripMarkdown(content);
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

/** Mixed CJK/latin reading time: ~380 CJK chars or ~210 words per minute. */
export function readingStats(content: string): { readingTime: number; wordCount: number } {
  const text = stripMarkdown(content);
  const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const latinWords = (
    text.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, " ").match(/[a-zA-Z0-9]+/g) ?? []
  ).length;
  const wordCount = cjk + latinWords;
  const minutes = cjk / 380 + latinWords / 210;
  return { readingTime: Math.max(1, Math.round(minutes)), wordCount };
}
