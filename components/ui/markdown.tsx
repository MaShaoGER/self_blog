import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { cn } from "@/lib/cn";

/**
 * Shared renderer for posts, the about page and the editor preview.
 * Raw HTML is not enabled, so post content cannot inject scripts.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn("article", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ href, children, ...rest }) => {
            const external = href ? /^https?:\/\//.test(href) : false;
            return (
              <a href={href} {...rest} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
          img: ({ src, alt }) =>
            typeof src === "string" && src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" />
            ) : alt?.startsWith("上传中") ? (
              <span className="block rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                图片上传中…
              </span>
            ) : null,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
