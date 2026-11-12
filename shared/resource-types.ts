export type ResourceKind = "folder" | "video" | "model" | "image" | "file";
export type ResourceVisibility = "public" | "private";
export type DirectFormat = "mp4" | "webm" | "hls" | "glb";
export type ResourceSource =
  | { type: "direct"; url: string; format?: DirectFormat; expiresAt?: string }
  | { type: "embed"; provider: "youtube" | "bilibili"; videoId: string };
export type ResourceInput = {
  name: string;
  description: string;
  kind: ResourceKind;
  parentId: string | null;
  visibility: ResourceVisibility;
  /** Hidden from anonymous directory listings; direct UUID access is still public. Defaults to true. */
  listed?: boolean;
  source?: ResourceSource;
  size?: number;
};
export type ResourceRecord = ResourceInput & { id: string; createdAt: string; updatedAt: string };
export type ResourceSummary = Omit<ResourceRecord, "source">;
export type ResourceListing = {
  items: ResourceSummary[];
  breadcrumbs: { id: string; name: string }[];
  nextCursor: string | null;
};
export type ResourceActionState = { status: "idle" | "success" | "error"; message?: string; field?: string };
