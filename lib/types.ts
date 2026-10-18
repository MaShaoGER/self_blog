export type PostStatus = "draft" | "published" | "scheduled";

export type PostMeta = {
  slug: string;
  title: string;
  /** ISO datetime. For scheduled posts this is the moment it goes public. */
  date: string;
  updated?: string;
  excerpt?: string;
  cover?: string;
  tags: string[];
  status: PostStatus;
  featured?: boolean;
  readingTime: number;
  wordCount: number;
};

export type Post = PostMeta & {
  content: string;
};

/** Fields the editor sends when saving. Derived stats are computed server-side. */
export type PostInput = {
  title: string;
  slug: string;
  date: string;
  excerpt?: string;
  cover?: string;
  tags: string[];
  status: PostStatus;
  featured?: boolean;
  content: string;
};

export type CommentStatus = "pending" | "approved" | "hidden";

export type Comment = {
  id: string;
  postSlug: string;
  author: string;
  website?: string;
  body: string;
  createdAt: string;
  status: CommentStatus;
  /** salted hash of submitter IP, never the raw address */
  ipHash?: string;
};

/** Comment shape safe to send to visitors. */
export type PublicComment = Pick<Comment, "id" | "author" | "website" | "body" | "createdAt">;

export type Project = {
  title: string;
  description: string;
  year: string;
  tags: string[];
  href?: string;
  demo?: string;
  status?: "活跃" | "归档" | "进行中";
  featured?: boolean;
};

export type SiteSettings = {
  title: string;
  tagline: string;
  description: string;
  author: string;
  avatar?: string;
  email?: string;
  github?: string;
  x?: string;
  aboutMarkdown: string;
  commentsAutoApprove: boolean;
};

export type Session = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  /** Human-readable device label parsed from the user agent, e.g. "iPhone · Safari". */
  device: string;
  /** Masked IP (e.g. 203.0.113.*) — enough for the owner to recognise, not to track. */
  ip: string;
};

export type UploadItem = {
  /** path relative to the uploads dir, e.g. 2026/10/abc.webp */
  path: string;
  url: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: string;
};
