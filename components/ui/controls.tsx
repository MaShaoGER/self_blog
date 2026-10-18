"use client";

import { cn } from "@/lib/cn";

/** 键帽按钮：3px 实体阴影，按下位移 3px。原生 button，键盘与焦点态保留。 */
export function KeyButton({
  children,
  className,
  tone = "paper",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "paper" | "safety" | "ink" }) {
  return (
    <button
      type={type}
      className={cn(
        "keybtn",
        tone === "safety" && "keybtn-safety",
        tone === "ink" && "keybtn-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** 凹槽输入框：mono 刻痕内阴影，focus 2px 橙 */
export function GrooveInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("groove", className)} {...props} />;
}
