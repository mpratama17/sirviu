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

/**
 * Mark semua notifikasi milik SAYA untuk 1 dokumen jadi read — dipanggil
 * saat halaman detail dokumen dibuka (lihat `MarkReadOnView`), supaya
 * highlight "belum dibuka" di tabel dashboard tidak nyangkut kalau user
 * masuk lewat baris tabel (bukan dari bel notifikasi).
 *
 * Plain `.update()`, bukan RPC — RLS `notifications_update` (`user_id =
 * auth.uid()`) sudah persis batas otorisasi yang dibutuhkan; tidak ada
 * state-machine mutation atau audit trail di sini yang butuh
 * security-definer. `.eq("user_id", ...)` tetap dituliskan eksplisit
 * (defense-in-depth, konsisten dengan pola di lib/actions/admin.ts)
 * walau RLS sudah menutupnya.
 */
export async function markDocumentNotificationsRead(
  documentId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Harus login." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("document_id", documentId)
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { success: false, error: error.message };
  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}
