"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/action-result";

const updateOwnProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(100, "Nama maksimal 100 karakter."),
});

/**
 * User mengubah nama sendiri (Milestone 6, halaman Profil). RLS
 * `users_update` (migration ...000002) sudah mengizinkan `id = auth.uid()`
 * update baris sendiri — trigger `enforce_user_update_columns` di migration
 * yang sama memastikan lewat jalur ini tetap tidak bisa mengubah
 * `roles`/`is_active` sendiri (hanya admin yang boleh, brief §7), jadi tidak
 * perlu guard tambahan di sini selain validasi nama.
 */
export async function updateOwnProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return { success: false, error: "Sesi Anda berakhir. Silakan login ulang." };
  }

  const parsed = updateOwnProfileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { error } = await supabase
    .from("users")
    .update({ name: parsed.data.name })
    .eq("id", authUser.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/profile");
  return { success: true, data: undefined };
}
