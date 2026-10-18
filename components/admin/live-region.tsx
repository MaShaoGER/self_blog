"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 给读屏器播报操作结果；同时作为一条短暂的可视提示。 */
export function useAnnouncer(timeout = 3200) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      // 先清空再写入，保证相同文案也会被重新播报
      setMessage("");
      requestAnimationFrame(() => setMessage(text));
      timer.current = setTimeout(() => setMessage(""), timeout);
    },
    [timeout],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { message, announce };
}

export function LiveRegion({ message, tone = "neutral" }: { message: string; tone?: "neutral" | "error" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="admin-toast"
      data-show={message ? "" : undefined}
      data-tone={tone}
    >
      {message}
    </div>
  );
}
