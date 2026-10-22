"use client";

import { useActionState, useId } from "react";
import { changeOwnPasswordAction, type ChangePasswordState } from "@/app/admin/(shell)/devices/password-actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changeOwnPasswordAction, { status: "idle" });
  const uid = useId();
  return (
    <section id="password" aria-labelledby={`${uid}-title`} className="scroll-mt-6 border-b border-line py-7">
      <h2 id={`${uid}-title`} className="text-base font-semibold text-ink">修改密码</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">修改后，所有设备会退出登录，请使用新密码重新登录。</p>
      <form action={action} className="mt-5 max-w-xl space-y-4" aria-label="修改自己的密码">
        <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
          <div>
            <label htmlFor={`${uid}-current`} className="block text-sm font-medium text-ink-soft">当前密码</label>
            <input id={`${uid}-current`} name="currentPassword" type="password" autoComplete="current-password" required className="field mt-1.5 h-11" />
          </div>
          <div>
            <label htmlFor={`${uid}-new`} className="block text-sm font-medium text-ink-soft">新密码</label>
            <input id={`${uid}-new`} name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby={`${uid}-hint`} className="field mt-1.5 h-11" />
            <p id={`${uid}-hint`} className="mt-1.5 text-xs text-muted">12–128 个字符，建议使用独立且不易猜测的密码。</p>
          </div>
          <div>
            <label htmlFor={`${uid}-confirm`} className="block text-sm font-medium text-ink-soft">确认新密码</label>
            <input id={`${uid}-confirm`} name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="field mt-1.5 h-11" />
          </div>
          <button type="submit" className="btn btn-primary h-11!">{pending ? "正在修改…" : "修改密码并退出登录"}</button>
        </fieldset>
        <p role="status" aria-live="polite" className="text-sm text-accent-ink">{pending ? "正在验证并修改密码…" : state.message}</p>
      </form>
    </section>
  );
}
