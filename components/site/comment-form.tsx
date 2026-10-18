"use client";

import { useActionState } from "react";
import { cn } from "@/lib/cn";
import { Grille, Screw, SilkStrip } from "@/components/ui/hardware";
import type { CommentFormState } from "@/app/(site)/posts/[slug]/comment-actions";

type Action = (prev: CommentFormState, fd: FormData) => Promise<CommentFormState>;

const INITIAL: CommentFormState = { status: "idle" };

/**
 * 评论输入区 = 文章的写实控件点位：塑料面板 + 凹槽输入 + 键帽提交。
 * 字段、Server Action、校验回显与 honeypot 与原来一致，只换外观。
 */
function Field({
  name,
  label,
  type = "text",
  required,
  maxLength,
  placeholder,
  hint,
  error,
  defaultValue,
  className,
}: {
  name: string;
  label: string;
  type?: "text" | "url" | "textarea";
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  className?: string;
}) {
  const id = `comment-${name}`;
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name,
    required,
    maxLength,
    placeholder,
    defaultValue,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": described,
  } as const;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="mono text-[0.75rem] tracking-[0.12em] text-ink uppercase">
          {label}
          {!required && <span className="ml-1.5 tracking-[0.06em] text-faint">选填</span>}
        </label>
        {hint && (
          <span id={`${id}-hint`} className="mono text-[0.6875rem] tracking-[0.06em] text-faint tabular-nums">
            {hint}
          </span>
        )}
      </div>
      {type === "textarea" ? (
        <textarea {...common} rows={5} className={cn("groove mt-2 min-h-28 resize-y", error && "border-accent")} />
      ) : (
        <input
          {...common}
          type={type}
          inputMode={type === "url" ? "url" : undefined}
          autoComplete={name === "author" ? "nickname" : "url"}
          className={cn("groove mt-2", error && "border-accent")}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="mono mt-1.5 text-[0.6875rem] leading-relaxed tracking-[0.02em] text-accent-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export function CommentForm({ action, className }: { action: Action; className?: string }) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const v = state.status === "error" ? state.values : undefined;
  const e = state.errors;

  return (
    <form action={formAction} aria-labelledby="comment-form-title" noValidate className={className}>
      <div className="flex items-baseline justify-between gap-4 border-b border-line-ink pb-2">
        <h3 id="comment-form-title" className="mono text-[0.75rem] tracking-[0.14em] text-muted uppercase">
          NEW ENTRY
          <span aria-hidden className="mx-2 text-faint">
            /
          </span>
          写评论
        </h3>
        <span aria-hidden className="mono text-[0.6875rem] tracking-[0.1em] text-faint uppercase">
          PLAIN TEXT
        </span>
      </div>

      <div className="metal relative mt-4 p-4 pt-6 sm:p-6 sm:pt-7">
        <div className="screw-corners pointer-events-none absolute inset-0" aria-hidden>
          <Screw size={9} />
          <Screw size={9} />
          <Screw size={9} />
          <Screw size={9} />
        </div>

        {/* Honeypot：对人类与辅助技术隐藏，只诱导机器人 */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="comment-company">公司</label>
          <input id="comment-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="relative">
          <div className="mb-4 flex items-center justify-between gap-3">
            <SilkStrip>INPUT / CH-A</SilkStrip>
            <Grille className="h-4 w-16 opacity-40" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="author" label="昵称" required maxLength={40} error={e?.author} defaultValue={v?.author} />
            <Field
              name="website"
              label="网址"
              type="url"
              maxLength={200}
              placeholder="https://"
              error={e?.website}
              defaultValue={v?.website}
            />
            <Field
              name="body"
              label="正文"
              type="textarea"
              required
              maxLength={2000}
              hint="最多 2000 字"
              error={e?.body}
              defaultValue={v?.body}
              className="sm:col-span-2"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <button type="submit" disabled={pending} className="keybtn keybtn-safety">
              {pending ? "正在提交" : "提交评论"}
              <span aria-hidden>→</span>
            </button>
            <p aria-live="polite" className="mono min-w-0 text-[0.6875rem] leading-relaxed tracking-[0.04em]">
              {state.status === "success" && <span className="text-green">{state.message}</span>}
              {state.status === "error" && state.message && <span className="text-accent-ink">{state.message}</span>}
              {state.status === "error" && !state.message && <span className="text-accent-ink">请先修改标出的内容</span>}
            </p>
          </div>
        </div>
      </div>

      <p className="mono mt-3 text-[0.6875rem] leading-relaxed tracking-[0.06em] text-faint">
        网址选填，填写后会公开链接；提交的评论可能需要审核后显示。
      </p>
    </form>
  );
}
