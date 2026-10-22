import { formatDate, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Sets digit runs in the tabular display face while the surrounding CJK stays in the sans stack. */
export function NumText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split(/(\d+)/).map((part, i) =>
        /^\d+$/.test(part) ? (
          <span key={i} className="num">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}

/** Calendar parts in the site time zone, from formatDateShort ("2026.10.18"). */
export function dateParts(iso: string): { year: string; month: string; day: string } {
  const [year = "", month = "", day = ""] = formatDateShort(iso).split(".");
  return { year, month, day };
}

export function PostDate({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} className={cn("tabular-nums", className)}>
      <NumText text={formatDate(iso)} />
    </time>
  );
}
