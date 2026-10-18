import type { Metadata } from "next";
import { Editor } from "@/components/admin/editor/editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "写新文章" };

export default function NewPostPage() {
  return (
    <Editor
      initial={{
        title: "",
        slug: "",
        date: new Date().toISOString(),
        excerpt: "",
        cover: "",
        tags: [],
        status: "draft",
        featured: false,
        content: "",
      }}
      originalSlug={null}
    />
  );
}
