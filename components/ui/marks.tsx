import { cn } from "@/lib/cn";

/**
 * 工业图形语言的基础标记。
 * 原则：每屏 ≤3 类，标记必须承载信息（编号 / 状态 / 关联），不做纯装饰。
 */

/** 叉框：表示"此格已归档 / 不可用" */
export function CrossBox({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 40 40"
      className={cn("size-10", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="0.5" y="0.5" width="39" height="39" />
      <path d="M1 1 39 39M39 1 1 39" />
    </svg>
  );
}

/** 裁切角标：四个 L 形定位角，档案图的取景框 */
export function CornerTicks({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 40 40"
      className={cn("size-10", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d="M0 6.5V0.5H6.5M33.5 0.5H39.5V6.5M39.5 33.5V39.5H33.5M6.5 39.5H0.5V33.5" />
    </svg>
  );
}

/** 十字定位 */
export function Crosshair({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 40 40"
      className={cn("size-10", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d="M20 10v20M10 20h20M20 12.5v2M20 25.5v2M12.5 20h2M25.5 20h2" />
    </svg>
  );
}

/** 刻度尺：8px 细刻度 + 40px 长刻度 */
export function Ruler({ className, ticks = 24 }: { className?: string; ticks?: number }) {
  const marks = Array.from({ length: ticks + 1 }, (_, i) => i);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${ticks * 8} 10`}
      preserveAspectRatio="none"
      className={cn("h-2.5 w-full", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      vectorEffect="non-scaling-stroke"
    >
      {marks.map((i) => (
        <path key={i} d={`M${i * 8 + 0.5} 0v${i % 5 === 0 ? 10 : 4}`} />
      ))}
    </svg>
  );
}

/** 条码：由字符串确定性生成，宽度是数据不是随机噪声 */
export function Barcode({ value, className, height = 28 }: { value: string; className?: string; height?: number }) {
  let hash = 2166136261;
  const bars: { w: number; gap: number }[] = [];
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    const h = hash >>> 0;
    bars.push({ w: 1 + (h % 3), gap: 1 + ((h >>> 3) % 2) });
  }
  const total = bars.reduce((s, b) => s + b.w + b.gap, 0);
  let x = 0;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${total} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-7 w-full", className)}
      fill="currentColor"
    >
      {bars.map((b, i) => {
        const rect = <rect key={i} x={x} y={0} width={b.w} height={height} />;
        x += b.w + b.gap;
        return rect;
      })}
    </svg>
  );
}

/** 警示斜纹 */
export function HazardTape({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("relative overflow-hidden border border-line-strong", className)}>
      <div aria-hidden className="hazard absolute inset-0 opacity-[0.22]" />
      {label && (
        <span className="mono relative px-2 py-1 text-[0.625rem] tracking-[0.22em] text-ink uppercase">{label}</span>
      )}
    </div>
  );
}

/** 编号前缀：NO. 042 / FIG. 01 / REV. 02 */
export function NoMark({
  prefix,
  value,
  className,
}: {
  prefix: string;
  value: string | number;
  className?: string;
}) {
  return (
    <span className={cn("mono text-[0.6875rem] tracking-[0.08em] whitespace-nowrap", className)}>
      <span className="text-faint">{prefix}</span>
      <span className="ml-1 text-ink tabular-nums">{typeof value === "number" ? String(value).padStart(3, "0") : value}</span>
    </span>
  );
}

/** 图注：FIG. 01 — 说明 / 来源 / 年份 */
export function FigCaption({ no, children, className }: { no: string; children: React.ReactNode; className?: string }) {
  return (
    <figcaption
      className={cn(
        "mono mt-2 flex gap-2 text-[0.6875rem] leading-relaxed tracking-[0.06em] text-muted",
        className,
      )}
    >
      <span className="text-accent-ink">FIG. {no}</span>
      <span aria-hidden className="text-faint">
        —
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </figcaption>
  );
}

/** 状态行：LED 圆点 + mono 文本 */
export function StatusLine({
  status = "online",
  children,
  className,
}: {
  status?: "online" | "warn" | "signal";
  children: React.ReactNode;
  className?: string;
}) {
  const ledClass = status === "warn" ? "led led-amber" : status === "signal" ? "led led-signal" : "led";
  return (
    <p className={cn("mono flex items-center gap-2 text-[0.6875rem] tracking-[0.08em] uppercase", className)}>
      <span aria-hidden className={ledClass} />
      <span>{children}</span>
    </p>
  );
}
