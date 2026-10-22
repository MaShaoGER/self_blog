import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { cn } from "@/lib/cn";
import { CodeToolbar } from "@/components/site/code-block";
import { ImageLightbox } from "@/components/site/lightbox";

/**
 * Shared renderer for posts, the about page and the editor preview.
 * Raw HTML is not enabled, so post content cannot inject scripts.
 * The body stays a server component; only the copy bar and the lightbox
 * are client islands.
 */

type HastNode = {
  type?: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  position?: { start?: { line?: number } };
  children?: HastNode[];
};

/** 语言铭牌：取语义词，认不出时退回 CODE（不把内部别名直接印上去）。 */
const LANG_LABEL: Record<string, string> = {
  bash: "SH",
  shell: "SH",
  sh: "SH",
  zsh: "SH",
  console: "SH",
  powershell: "PS",
  ps1: "PS",
  typescript: "TS",
  ts: "TS",
  tsx: "TSX",
  javascript: "JS",
  js: "JS",
  jsx: "JSX",
  json: "JSON",
  jsonc: "JSON",
  css: "CSS",
  scss: "SCSS",
  less: "LESS",
  html: "HTML",
  xml: "XML",
  svg: "SVG",
  markdown: "MD",
  md: "MD",
  yaml: "YML",
  yml: "YML",
  toml: "TOML",
  python: "PY",
  py: "PY",
  rust: "RS",
  rs: "RS",
  go: "GO",
  java: "JAVA",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  sql: "SQL",
  diff: "DIFF",
  patch: "DIFF",
  nginx: "NGINX",
  dockerfile: "DOCKER",
  makefile: "MAKE",
  ini: "INI",
  plaintext: "TXT",
  text: "TXT",
};

function languageLabel(raw: string | undefined): string {
  if (!raw) return "CODE";
  const key = raw.toLowerCase();
  return LANG_LABEL[key] ?? key.toUpperCase();
}

function textContent(node: HastNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textContent).join("");
}

/**
 * 行号 → 作者写的围栏语言。rehype-highlight 开了 detect，会把无语言代码块
 * 猜成 `language-arduino` 之类；铭牌只认原文里真正写了的那个。
 */
function fenceLanguages(source: string): Map<number, string> {
  const map = new Map<number, string>();
  source.split(/\r?\n/).forEach((line, i) => {
    const match = /^[\s>]*(?:```+|~~~+)[ \t]*([^\s`~]*)/.exec(line);
    // 空串表示作者没写语言：此时不采信 detect 猜出来的结果
    if (match) map.set(i + 1, match[1]);
  });
  return map;
}

/** 取语言名与代码纯文本；语言优先读原文围栏，其次读 highlight 注入的 class。 */
function codeBlockInfo(node: HastNode | undefined, fences: Map<number, string>) {
  const codeEl = node?.children?.find((child) => child.type === "element" && child.tagName === "code");
  const classes = codeEl?.properties?.className;
  const list = Array.isArray(classes) ? classes : [];
  const langClass = list.find(
    (item): item is string => typeof item === "string" && item.startsWith("language-"),
  );
  const startLine = node?.position?.start?.line;
  const written = typeof startLine === "number" ? fences.get(startLine) : undefined;
  const fromClass = langClass?.slice("language-".length);
  return {
    // 原文写了空语言（```）时铭牌就是 CODE，不采信 detect 猜出来的语言
    language: written !== undefined ? languageLabel(written || undefined) : languageLabel(fromClass),
    code: textContent(codeEl).replace(/\n$/, ""),
  };
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const fences = fenceLanguages(source);
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
          pre: ({ node, children, ...rest }) => {
            const { language, code } = codeBlockInfo(node, fences);
            return (
              <div className="my-[1.8em]! border border-line-ink">
                <CodeToolbar language={language} code={code} />
                <pre {...rest} className="my-0! border-0!">
                  {children}
                </pre>
              </div>
            );
          },
          img: ({ src, alt }) =>
            typeof src === "string" && src ? (
              <ImageLightbox src={src} alt={alt ?? ""} />
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
