"use server";

import { revalidatePath } from "next/cache";
import { assertSession, revokeOtherSessions, revokeSession } from "@/lib/auth";

export async function revokeDeviceAction(id: string): Promise<void> {
  const me = await assertSession();
  if (typeof id !== "string" || !id) throw new Error("参数不正确");
  if (id === me.id) throw new Error("不能在这里移除当前设备，请用「退出登录」");
  await revokeSession(id, me.accountId);
  revalidatePath("/admin/devices");
}

export async function revokeOtherDevicesAction(): Promise<void> {
  const me = await assertSession();
  await revokeOtherSessions(me.id, me.accountId);
  revalidatePath("/admin/devices");
}
