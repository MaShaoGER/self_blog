"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { revokeDeviceAction, revokeOtherDevicesAction } from "@/app/admin/(shell)/devices/actions";
import { ConfirmButton } from "./confirm-button";
import { LiveRegion, useAnnouncer } from "./live-region";

export type DeviceItem = {
  id: string;
  device: string;
  ip: string;
  createdAt: string;
  createdText: string;
  lastSeenAt: string;
  lastSeenText: string;
  current: boolean;
};

function isMobile(label: string) {
  return /iphone|ipad|android|手机|平板|mobile/i.test(label);
}

export function DeviceList({ devices: initial }: { devices: DeviceItem[] }) {
  const [devices, setDevices] = useState(initial);
  const { message, announce } = useAnnouncer();
  const others = devices.filter((d) => !d.current);

  return (
    <>
      <LiveRegion message={message} />

      <ul className="divide-y divide-line border-b border-line">
        {devices.map((d) => {
          const Icon = isMobile(d.device) ? Smartphone : Monitor;
          return (
            <li key={d.id} className="flex items-start gap-4 py-4">
              <Icon aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[0.9375rem] font-medium text-ink">{d.device || "未知设备"}</span>
                  {d.current && <span className="text-[0.8125rem] font-medium text-green">当前设备</span>}
                </p>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.8125rem] sm:grid-cols-[auto_auto_auto_auto_auto_1fr] sm:gap-x-2">
                  <dt className="text-faint">IP</dt>
                  <dd className="font-mono text-[0.75rem] leading-5 text-ink-soft sm:mr-4">{d.ip || "未知"}</dd>
                  <dt className="text-faint">登录于</dt>
                  <dd className="tabular-nums text-ink-soft sm:mr-4">
                    <time dateTime={d.createdAt}>{d.createdText}</time>
                  </dd>
                  <dt className="text-faint">最后活跃</dt>
                  <dd className="tabular-nums text-ink-soft">
                    <time dateTime={d.lastSeenAt}>{d.lastSeenText}</time>
                  </dd>
                </dl>
              </div>
              {!d.current && (
                <ConfirmButton
                  className="btn btn-ghost -mt-1 h-11! shrink-0 px-3.5! md:h-9!"
                  aria-label={`移除设备 ${d.device}`}
                  title={`移除「${d.device || "未知设备"}」？`}
                  description="这台设备会立即退出后台，下次需要重新输入密码。"
                  confirmLabel="移除这台设备"
                  action={async () => {
                    await revokeDeviceAction(d.id);
                    setDevices((cur) => cur.filter((x) => x.id !== d.id));
                    announce(`已移除 ${d.device}`);
                  }}
                >
                  移除
                </ConfirmButton>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
        <p className="text-[0.875rem] text-muted">
          {others.length
            ? `除了当前设备，还有 ${others.length} 台设备保持登录。`
            : "只有当前设备登录着后台。要退出这台设备，用导航里的「退出登录」。"}
        </p>
        {others.length > 0 && (
          <ConfirmButton
            className="btn btn-ghost h-11! md:h-10!"
            title="退出其他所有设备？"
            description={`另外 ${others.length} 台设备会立即退出后台，当前设备不受影响。`}
            confirmLabel="退出其他设备"
            action={async () => {
              await revokeOtherDevicesAction();
              setDevices((cur) => cur.filter((x) => x.current));
              announce("其他设备已全部退出");
            }}
          >
            退出其他所有设备
          </ConfirmButton>
        )}
      </div>
    </>
  );
}
