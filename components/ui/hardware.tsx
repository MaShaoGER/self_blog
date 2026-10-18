import { cn } from "@/lib/cn";

/**
 * 硬件面板零件（v0.3）。
 * 与 marks.tsx 的分工：marks 是平面标记（印刷），hardware 是立体零件（材质）。
 * 纪律：只用于交互点与状态块；正文阅读区不得出现。
 */

/** 螺丝：一字槽，四角固定用 */
export function Screw({ size = 11, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("screw", className)}
      style={{ ["--screw" as string]: `${size}px` }}
    />
  );
}

/** 四角螺丝：包一层容器，自动定位到四角 */
export function ScrewCorners({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("screw-corners relative", className)}>
      <Screw />
      <Screw />
      <Screw />
      <Screw />
      {children}
    </div>
  );
}

/** 金属面板：拉丝质感外壳 */
export function MetalPanel({
  className,
  dark = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { dark?: boolean }) {
  return (
    <div className={cn(dark ? "metal-dark" : "metal", className)} {...props}>
      {children}
    </div>
  );
}

/** 旋钮：外圈刻度 + 塑料帽 + 指线。角度 -135°～135° */
export function Knob({
  angle = -35,
  size = 64,
  className,
  label,
}: {
  angle?: number;
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span className={cn("knob-ring", className)} style={{ ["--angle" as string]: `${angle}deg` }}>
      <span aria-hidden className="knob" style={{ ["--knob" as string]: `${size}px` }} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** 推子：凹槽轨道 + 橡胶滑块，value 0–100 控制位置（仅展示用） */
export function Fader({
  value = 50,
  className,
  label,
}: {
  value?: number;
  className?: string;
  label?: string;
}) {
  const pos = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("fader", className)}>
      <span aria-hidden className="fader-thumb" style={{ left: `${pos}%` }} />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

/** 网孔格栅块：小面积透气网 */
export function Grille({ className }: { className?: string }) {
  return <div aria-hidden className={cn("grille", className)} />;
}

/** 丝印标签条：橙底反白小条 */
export function SilkStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("silk-strip", className)}>{children}</span>;
}

/** 荧光屏：橙色 LED 点阵质感容器 */
export function GlowScreen({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("lcd-glow", className)} {...props}>
      {children}
    </div>
  );
}
