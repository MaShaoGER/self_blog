"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="mt-7 min-w-0">
      <input type="hidden" name="next" value={next} />

      <label htmlFor="username" className="mono block text-[0.625rem] tracking-[0.16em] text-[#8e8a80] uppercase">
        用户名 / USERNAME
      </label>
      <input
        id="username" name="username" type="text" required autoFocus
        autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={32}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "login-error" : undefined}
        className="groove mt-2 mb-5 h-11 min-w-0 border-[#3a3a3e] bg-[#0f0f11] text-[#e8e4da]"
      />

      <label htmlFor="password" className="mono block text-[0.625rem] tracking-[0.16em] text-[#8e8a80] uppercase">
        密码 / PASSWORD
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "login-error" : undefined}
        className="groove mt-2 h-11 min-w-0 border-[#3a3a3e] bg-[#0f0f11] text-[#e8e4da] placeholder:text-[#5a564e]"
      />

      <p id="login-error" role="alert" aria-live="polite" className="mono mt-2 min-h-5 text-[0.6875rem] text-[#ff8a5c]">
        {state.error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mono mt-3 h-11 w-full cursor-pointer border border-[#8a2a0b] bg-[#d1490f] text-[0.6875rem] tracking-[0.16em] text-[#fff8f3] uppercase transition-colors hover:bg-[#e8531f] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "正在登录…" : "解锁 / ENTER"}
      </button>
    </form>
  );
}
