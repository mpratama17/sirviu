"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/action-result";

/**
 * Notifikasi in-app. Storage-nya di `public.notifications` (migration
 * ...20260830000003). Baris di-insert oleh RPC state-transition (via
 * `_notify_stage_holder`) — server actions di sini hanya untuk mark-as-read.
 */
export async function markNotificationRead(
  notificationId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}

export async function markAllNotificationsRead(): Promise<ActionResult<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_all_notifications_read");
  if (error) return { success: false, error: error.message };
  revalidatePath("/", "layout");
  return { success: true, data: data ?? 0 };
}
