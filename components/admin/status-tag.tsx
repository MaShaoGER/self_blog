import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "green" | "faint";

const TONES: Record<Tone, string> = {
  neutral: "text-ink-soft before:bg-ink-soft",
  accent: "text-accent-ink before:bg-accent",
  green: "text-green before:bg-green",
  faint: "text-muted before:bg-faint",
};

/** 小圆点 + 文字的状态标记，不做色块胶囊。 */
export function StatusTag({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8125rem] before:size-1.5 before:shrink-0 before:rounded-full before:content-['']",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
