import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Editor } from "@/components/admin/editor/editor";
import { getPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = await getPost((await params).slug);
  return { title: post ? `编辑「${post.title}」` : "文章不存在" };
}

export default async function EditPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  return (
    <Editor
      initial={{
        title: post.title,
        slug: post.slug,
        date: post.date,
        excerpt: post.excerpt && post.excerpt !== "" ? post.excerpt : "",
        cover: post.cover ?? "",
        tags: post.tags,
        status: post.status,
        featured: post.featured ?? false,
        content: post.content,
      }}
      originalSlug={post.slug}
    />
  );
}
