"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import type { AccountRole, PublicAccount } from "@/lib/account-types";
import {
  createAccountAction,
  updateAccountAction,
  resetAccountPasswordAction,
  type AccountActionState,
} from "@/app/admin/(shell)/accounts/actions";

const initialState: AccountActionState = { status: "idle" };
const labelClass = "block text-sm font-medium text-ink-soft";
const fieldClass = "field mt-1.5 h-11 min-w-0";

function ActionStatus({ state, pending }: { state: AccountActionState; pending: boolean }) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className={`min-w-0 text-sm leading-relaxed ${state.status === "error" ? "text-accent-ink" : state.status === "success" ? "text-green" : "text-muted"}`}>
      {pending ? "正在处理…" : state.message}
    </p>
  );
}

function RoleSelect({ id, value, onChange }: { id: string; value: AccountRole; onChange: (value: AccountRole) => void }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>角色</label>
      <select id={id} name="role" value={value} onChange={(event) => onChange(event.target.value === "admin" ? "admin" : "editor")} className={fieldClass}>
        <option value="editor">编辑</option>
        <option value="admin">管理员</option>
      </select>
    </div>
  );
}

function CreateAccountForm() {
  const [state, action, pending] = useActionState(createAccountAction, initialState);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AccountRole>("editor");
  const uid = useId();
  return (
    <section aria-labelledby={`${uid}-title`} className="border-b border-line py-7">
      <div className="mb-5">
        <h2 id={`${uid}-title`} className="text-base font-semibold text-ink">创建账号</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">创建后，将用户名和初始密码告知协作者。对方可登录后自行修改密码。</p>
      </div>
      <form action={action} aria-label="创建账号" className="space-y-4">
        <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_8rem] disabled:opacity-60">
          <div className="min-w-0">
            <label htmlFor={`${uid}-username`} className={labelClass}>用户名</label>
            <input id={`${uid}-username`} name="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={32} pattern={"[a-z0-9][a-z0-9_\\-]{2,31}"} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby={`${uid}-username-hint`} className={fieldClass} />
            <p id={`${uid}-username-hint`} className="mt-1.5 text-xs leading-relaxed text-muted">3–32 位小写字母、数字、_ 或 -，以字母或数字开头</p>
          </div>
          <div className="min-w-0">
            <label htmlFor={`${uid}-name`} className={labelClass}>显示名称</label>
            <input id={`${uid}-name`} name="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={60} autoComplete="off" className={fieldClass} />
          </div>
          <RoleSelect id={`${uid}-role`} value={role} onChange={setRole} />
          <div className="min-w-0 sm:col-span-2 lg:col-span-2">
            <label htmlFor={`${uid}-password`} className={labelClass}>初始密码</label>
            <input id={`${uid}-password`} name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-describedby={`${uid}-password-hint`} className={fieldClass} />
            <p id={`${uid}-password-hint`} className="mt-1.5 text-xs text-muted">12–128 个字符</p>
          </div>
          <div className="flex items-start lg:pt-[1.625rem]">
            <button type="submit" className="btn btn-primary h-11! w-full sm:w-auto lg:w-full">{pending ? "正在创建…" : "创建账号"}</button>
          </div>
        </fieldset>
        <ActionStatus state={state} pending={pending} />
      </form>
    </section>
  );
}

function ResetPasswordForm({ account }: { account: PublicAccount }) {
  const [state, action, pending] = useActionState(resetAccountPasswordAction, initialState);
  const uid = useId();
  return (
    <details className="mt-4 border-t border-line pt-4">
      <summary className="w-fit cursor-pointer text-sm font-medium text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">重置密码</summary>
      <form action={action} aria-label={`重置 ${account.username} 的密码`} className="mt-4 space-y-3">
        <input type="hidden" name="accountId" value={account.id} />
        <p id={`${uid}-hint`} className="text-xs leading-relaxed text-muted">重置后，该账号的所有设备会退出登录。请将新密码告知账号使用者。</p>
        <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end disabled:opacity-60">
          <div className="min-w-0 flex-1">
            <label htmlFor={`${uid}-password`} className={labelClass}>新密码（12–128 个字符）</label>
            <input id={`${uid}-password`} name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby={`${uid}-hint`} className={fieldClass} />
          </div>
          <button type="submit" className="btn btn-secondary h-11! shrink-0">{pending ? "正在重置…" : "确认重置密码"}</button>
        </fieldset>
        <ActionStatus state={state} pending={pending} />
      </form>
    </details>
  );
}

function AccountRow({ account, current }: { account: PublicAccount; current: boolean }) {
  const [state, action, pending] = useActionState(updateAccountAction, initialState);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [role, setRole] = useState<AccountRole>(account.role);
  const [enabled, setEnabled] = useState(account.enabled ? "true" : "false");
  const uid = useId();
  return (
    <article aria-labelledby={`${uid}-title`} className="min-w-0 border-b border-line py-5">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-6">
        <div className="min-w-0">
          <h3 id={`${uid}-title`} className="break-all font-mono text-sm font-medium text-ink">{account.username}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={account.enabled ? "text-green" : "text-muted"}>{account.enabled ? "已启用" : "已停用"}</span>
            <span className="text-muted">{account.role === "admin" ? "管理员" : "编辑"}</span>
            {current ? <span className="border border-line px-1.5 py-0.5 text-ink-soft">当前账号</span> : null}
          </div>
        </div>
        <div className="min-w-0">
          <form action={action} aria-label={`编辑账号 ${account.username}`} className="space-y-3">
            <input type="hidden" name="accountId" value={account.id} />
            <fieldset disabled={pending} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] disabled:opacity-60">
              <div className="min-w-0">
                <label htmlFor={`${uid}-name`} className={labelClass}>显示名称</label>
                <input id={`${uid}-name`} name="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={60} autoComplete="off" className={fieldClass} />
              </div>
              <RoleSelect id={`${uid}-role`} value={role} onChange={setRole} />
              <div className="min-w-0">
                <label htmlFor={`${uid}-enabled`} className={labelClass}>账号状态</label>
                <select id={`${uid}-enabled`} name="enabled" value={enabled} onChange={(event) => setEnabled(event.target.value)} className={fieldClass}>
                  <option value="true">启用</option>
                  <option value="false">停用</option>
                </select>
              </div>
              <div className="flex items-end">
                <button type="submit" className="btn btn-secondary h-11! w-full lg:w-auto">{pending ? "保存中…" : "保存资料"}</button>
              </div>
            </fieldset>
            <ActionStatus state={state} pending={pending} />
          </form>
          {current ? <p className="mt-4 text-xs leading-relaxed text-muted">修改自己的密码请前往 <Link href="/admin/devices#password" className="font-medium text-ink underline underline-offset-4">我的账号</Link>。</p> : <ResetPasswordForm account={account} />}
        </div>
      </div>
    </article>
  );
}

export function AccountManager({ accounts, currentAccountId }: { accounts: PublicAccount[]; currentAccountId: string }) {
  return (
    <div className="min-w-0">
      <div className="grid gap-4 border-b border-line py-5 text-sm leading-relaxed sm:grid-cols-2">
        <p className="text-muted"><span className="font-medium text-ink">管理员</span><br />管理文章、图片和评论，以及账号与站点设置。</p>
        <p className="text-muted"><span className="font-medium text-ink">编辑</span><br />管理文章、图片和评论，可修改自己的密码和管理自己的登录设备。</p>
      </div>
      <CreateAccountForm />
      <section aria-labelledby="accounts-list-title" className="pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
          <h2 id="accounts-list-title" className="text-base font-semibold text-ink">现有账号 <span className="ml-1 font-mono text-sm font-normal text-muted">{accounts.length}</span></h2>
          <p className="text-xs leading-relaxed text-muted">停用会退出该账号的所有设备；保留账号资料。</p>
        </div>
        {accounts.map((account) => <AccountRow key={account.id} account={account} current={account.id === currentAccountId} />)}
      </section>
    </div>
  );
}
