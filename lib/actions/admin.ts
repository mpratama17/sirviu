"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/session";
import { addUserSchema, editUserSchema } from "@/lib/validators/admin";
import type { ActionResult } from "@/lib/types/action-result";

/**
 * Semua aksi di file ini hanya boleh dijalankan admin. Sebagian pakai
 * service role (createAdminClient) — WAJIB cek admin di sini dulu,
 * karena service role bypass RLS sepenuhnya dan tidak ada proteksi lain
 * di baliknya. Lihat AGENTS.md.
 */
async function requireAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesi Anda berakhir. Silakan login ulang." };
  if (!user.roles.includes("admin")) {
    return { ok: false, error: "Hanya admin yang boleh melakukan aksi ini." };
  }
  return { ok: true };
}

function parseRoles(formData: FormData): string[] {
  return formData.getAll("roles").map(String);
}

/**
 * Tambah pengguna baru — invite via email (brief §"Tambah Pengguna").
 * `inviteUserByEmail` adalah GoTrue Admin API, HANYA bisa lewat service
 * role — tidak ada jalur lain untuk membuat auth.users row secara admin.
 * Setelah invite, trigger `handle_new_user` otomatis buat row
 * public.users dengan roles kosong; kita update roles-nya di sini juga
 * lewat client yang sama (masih dalam satu operasi admin).
 *
 * Catatan: pengiriman email invite tergantung konfigurasi SMTP project
 * Supabase — di free tier ada rate limit ketat. User row & akses tetap
 * ke-provision walau emailnya lambat/gagal terkirim.
 */
export async function addUser(formData: FormData): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = addUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    roles: parseRoles(formData),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.name },
  });

  if (error || !data.user) {
    return { success: false, error: error?.message ?? "Gagal mengundang pengguna." };
  }

  const { error: roleError } = await admin
    .from("users")
    .update({ name: parsed.data.name, roles: parsed.data.roles })
    .eq("id", data.user.id);

  if (roleError) {
    return { success: false, error: roleError.message };
  }

  revalidatePath("/admin/users");
  return { success: true, data: undefined };
}

/**
 * Edit nama/roles/status user. Pakai session client (BUKAN service role)
 * — RLS `users_update` + trigger `enforce_user_update_columns` sudah
 * secara eksplisit mengizinkan admin mengubah roles/is_active user lain
 * (brief §7). Ini defense in depth: kalau `requireAdmin()` di atas somehow
 * punya bug, DB-level masih menolak non-admin.
 */
export async function updateUser(formData: FormData): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const parsed = editUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    roles: parseRoles(formData),
    isActive: formData.get("isActive") === "true",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  // assign_team_member cuma pernah mengizinkan seorang anggota tim kalau dia
  // aktif, punya salah satu role dalnis/dalmut/operator, dan BUKAN
  // ketua_tim/admin (migration 20260831000003). Kalau admin mengedit role
  // seseorang lewat sini sampai melanggar invariant itu (mis. dipromosikan
  // jadi ketua_tim, atau kehilangan role reviewer terakhirnya),
  // team_ketua_tim_id lama-nya jadi data usang — orang itu tetap "tampil"
  // sebagai anggota tim di panel admin padahal sudah tidak semestinya bisa
  // jadi anggota. Deaktivasi SENGAJA tidak ikut membersihkan ini (lihat
  // AdminTeamsPanel — badge "Nonaktif" per anggota, roster-nya tetap utuh
  // supaya reaktivasi tidak perlu assign ulang; sama seperti kartu header
  // Ketua Tim yang juga tetap tampil nonaktif, bukan hilang).
  const violatesTeamMembership =
    parsed.data.roles.includes("ketua_tim") ||
    parsed.data.roles.includes("admin") ||
    !parsed.data.roles.some((r) => ["dalnis", "dalmut", "operator"].includes(r));

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({
      name: parsed.data.name,
      roles: parsed.data.roles,
      is_active: parsed.data.isActive,
      ...(violatesTeamMembership ? { team_ketua_tim_id: null } : {}),
    })
    .eq("id", parsed.data.userId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/users");
  revalidatePath("/team");
  return { success: true, data: undefined };
}

/** Toggle cepat aktif/non-aktif dari table row, tanpa buka modal edit. */
export async function toggleUserActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/users");
  return { success: true, data: undefined };
}
