import type { Metadata } from "next";
import { cn } from "@/lib/cn";
import { readProjects } from "@/lib/projects";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "项目" };

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 状态只改字色，不加第二套标记：活跃可维护 / 进行中断续 / 归档停更，无状态用 faint。 */
function statusTone(status: Project["status"]): string {
  switch (status) {
    case "活跃":
      return "text-green";
    case "进行中":
      return "text-accent-ink";
    case "归档":
      return "text-muted";
    default:
      return "text-faint";
  }
}

/**
 * 项目行 = 参数表一行。
 * 桌面 6 列（NO. / PROJECT / YEAR / STATUS / CAT / ↗），移动端两行：标题 + 描述 + 参数行。
 * 整行是外链（新窗口），没有链接的项目退化成纯文本行。
 */
function ProjectRow({ project, no }: { project: Project; no: number }) {
  const link = project.href ?? project.demo;
  const isDemoOnly = !project.href && Boolean(project.demo);

  const cells = (
    <>
      <span className="mono text-[0.6875rem] tracking-[0.06em] text-faint tabular-nums">{pad2(no)}</span>

      <span className="min-w-0">
        <span className="flex min-w-0 items-baseline gap-2.5">
          <span className="display min-w-0 truncate text-[1.0625rem] leading-tight text-ink transition-colors group-hover:text-accent-ink md:text-[1.1875rem]">
            {project.title}
          </span>
          {project.featured && (
            <span className="mono flex shrink-0 items-center gap-1.5 text-[0.625rem] leading-none tracking-[0.1em] text-signal uppercase">
              <span aria-hidden className="led led-signal scale-75" />
              FEATURED
            </span>
          )}
        </span>

        {project.description && (
          <span className="mt-1.5 line-clamp-2 block max-w-[66ch] text-[0.8125rem] leading-relaxed text-muted">
            {project.description}
          </span>
        )}

        {/* 移动端：参数折进标题下方一行 */}
        <span className="mono mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[0.625rem] tracking-[0.06em] text-faint tabular-nums md:hidden">
          <span>{project.year}</span>
          {project.status && (
            <>
              <span aria-hidden>·</span>
              <span className={statusTone(project.status)}>{project.status}</span>
            </>
          )}
          {project.tags.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{project.tags.join(" / ")}</span>
            </>
          )}
        </span>
      </span>

      <span className="mono hidden text-[0.6875rem] tracking-[0.06em] text-muted tabular-nums md:block">
        {project.year}
      </span>

      <span className={cn("mono hidden text-[0.6875rem] tracking-[0.08em] md:block", statusTone(project.status))}>
        {project.status ?? "—"}
      </span>

      <span className="hidden min-w-0 lg:block">
        {project.tags.length > 0 ? (
          <span className="mono inline-flex max-w-full items-baseline gap-1.5 text-[0.625rem] tracking-[0.06em] text-muted">
            <span className="inline-block max-w-[8.5rem] truncate border border-line-strong px-1.5 py-[3px] leading-none text-ink">
              {project.tags[0]}
            </span>
            {project.tags.length > 1 && <span className="shrink-0 text-faint">+{project.tags.length - 1}</span>}
          </span>
        ) : (
          <span aria-hidden className="mono text-[0.6875rem] text-faint">
            —
          </span>
        )}
      </span>

      <span
        aria-hidden
        className={cn(
          "mono self-center text-right text-[0.875rem]",
          link
            ? "text-faint transition-transform duration-150 group-hover:translate-x-1 group-hover:text-accent"
            : "text-faint",
        )}
      >
        {link ? "↗" : "—"}
      </span>
    </>
  );

  const rowClass =
    "grid items-baseline gap-x-5 gap-y-1.5 py-4 md:py-[1.125rem] " +
    "grid-cols-[2.75rem_minmax(0,1fr)_1.75rem] " +
    "md:grid-cols-[4rem_minmax(0,1fr)_4.5rem_6rem_1.75rem] " +
    "lg:grid-cols-[4rem_minmax(0,1fr)_4.5rem_6rem_11rem_1.75rem]";

  return (
    <li className="group border-b border-line">
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(rowClass, "transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)]")}
        >
          {cells}
          <span className="sr-only">
            {project.title}，{isDemoOnly ? "打开演示" : "打开项目"}（新窗口）
          </span>
        </a>
      ) : (
        <div className={rowClass}>{cells}</div>
      )}
    </li>
  );
}

/**
 * 项目页 = 作品参数表。
 * 版式沿用 /archive 与 /tags：mono 眉标 + display 大标题 + NN ITEMS 铭牌 + 1px 列表。
 * 标记只用三样：编号列、状态字色、featured 的信号色小字。
 */
export default async function ProjectsPage() {
  const projects = await readProjects();
  const years = projects.map((p) => p.year).filter(Boolean).sort();
  const span = years.length > 1 ? `${years[0]}–${years.at(-1)}` : (years[0] ?? "———");

  return (
    <div className="sheet">
      <header className="wrap border-b border-line-ink pt-10 pb-8 lg:pt-14 lg:pb-10">
        <p className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
          PROJECTS <span aria-hidden className="text-faint">/</span> 项目
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <h1 className="display text-[clamp(2.75rem,9vw,5.25rem)]">项目</h1>
            <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-soft">
              工具、页面，以及做到一半停下的东西。按年份从新到旧排列；状态说的是它现在还能不能用，不是完成度。
            </p>
          </div>

          <p className="mono shrink-0 text-[0.8125rem] tracking-[0.1em] text-ink uppercase tabular-nums">
            {pad2(projects.length)} ITEMS
            <span aria-hidden className="mx-1.5 text-faint">
              /
            </span>
            {span}
          </p>
        </div>
      </header>

      <section aria-labelledby="project-index" className="wrap py-8 lg:py-10">
        <div className="mb-6 flex items-end justify-between gap-6">
          <h2 id="project-index" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
            INDEX / 项目表
          </h2>
          <span aria-hidden className="mono hidden text-[0.625rem] tracking-[0.08em] text-faint uppercase sm:block">
            NO. · PROJECT · YEAR · STATUS · CAT
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="border-t border-line-ink py-14">
            <p className="display text-[1.5rem] text-ink">NO RECORDS</p>
            <p className="mt-2 max-w-[52ch] text-muted">
              还没有记录项目。等第一件值得留档的事做完，会补在这里。
            </p>
          </div>
        ) : (
          <ol className="border-t border-line-ink">
            {projects.map((p, i) => (
              <ProjectRow key={`${p.title}-${p.year}`} project={p} no={i + 1} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
