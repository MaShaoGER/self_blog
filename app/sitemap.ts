import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { getAllSeries, getAllTags, getLivePosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [posts, tags, series] = await Promise.all([getLivePosts(), getAllTags(), getAllSeries()]);
  const latest = posts[0] ? new Date(posts[0].updated ?? posts[0].date) : new Date();

  return [
    { url: `${base}/`, lastModified: latest, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/archive`, lastModified: latest, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/projects`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/series`, lastModified: latest, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/tags`, lastModified: latest, changeFrequency: "weekly", priority: 0.4 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    ...posts.map((p) => ({
      url: `${base}/posts/${p.slug}`,
      lastModified: new Date(p.updated ?? p.date),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...series.map((s) => ({
      url: `${base}/series/${encodeURIComponent(s.name)}`,
      lastModified: new Date(s.posts.at(-1)?.updated ?? s.posts.at(-1)?.date ?? Date.now()),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...tags.map((t) => ({
      url: `${base}/tags/${encodeURIComponent(t.tag)}`,
      changeFrequency: "weekly" as const,
      priority: 0.3,
    })),
  ];
}
