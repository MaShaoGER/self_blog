import GithubSlugger from "github-slugger";

export type Heading = { depth: 2 | 3; text: string; id: string };

/** Extract h2/h3 for the table of contents, with ids matching rehype-slug. */
export function extractHeadings(md: string): Heading[] {
  const slugger = new GithubSlugger();
  const out: Heading[] = [];
  let fenced = false;
  for (const line of md.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = m[2].replace(/[*_`~]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    // Every heading advances the slugger so duplicate-id suffixes stay in sync.
    const id = slugger.slug(text);
    if (m[1].length === 2 || m[1].length === 3) out.push({ depth: m[1].length as 2 | 3, text, id });
  }
  return out;
}
