"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import type { ActionResult } from "@/lib/types/action-result";

/**
 * Keanggotaan tim (Ketua Tim ↔ dalnis/dalmut/operator) — masukan user
 * setelah testing, lihat AGENTS.md. Self-service oleh Ketua Tim sendiri,
 * lewat RPC `assign_team_member`/`remove_team_member` (security definer,
 * trust boundary sebenarnya — actor & semua guard "sudah di tim lain?"
 * dicek ulang di dalam RPC, jangan andalkan validasi di sini saja).
 *
 * `ketuaTimId` cuma dipakai admin (panel semua tim di /admin/users). Cek
 * admin di sini defense-in-depth saja — RPC-nya juga mengabaikan parameter
 * itu total kalau actor-nya bukan admin, jadi tidak ada jalan bagi Ketua
 * Tim biasa untuk menaruh anggota di tim orang lain.
 */
const memberIdSchema = z.object({ memberId: z.uuid() });
const adminAssignSchema = z.object({ memberId: z.uuid(), ketuaTimId: z.uuid() });

export async function addTeamMember(
  memberId: string,
  ketuaTimId?: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  if (ketuaTimId !== undefined) {
    const parsed = adminAssignSchema.safeParse({ memberId, ketuaTimId });
    if (!parsed.success) return { success: false, error: "Data tidak valid." };

    const currentUser = await getCurrentUser();
    if (!currentUser?.roles.includes("admin")) {
      return { success: false, error: "Hanya admin yang boleh mengatur tim orang lain." };
    }

    const { error } = await supabase.rpc("assign_team_member", {
      p_member_id: parsed.data.memberId,
      p_ketua_tim_id: parsed.data.ketuaTimId,
    });
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/users");
    revalidatePath("/team"); // roster KT yang diedit admin jangan basi
    return { success: true, data: undefined };
  }

  const parsed = memberIdSchema.safeParse({ memberId });
  if (!parsed.success) {
    return { success: false, error: "User tidak valid." };
  }

  const { error } = await supabase.rpc("assign_team_member", {
    p_member_id: parsed.data.memberId,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/team");
  return { success: true, data: undefined };
}

export async function removeTeamMember(memberId: string): Promise<ActionResult> {
  const parsed = memberIdSchema.safeParse({ memberId });
  if (!parsed.success) {
    return { success: false, error: "User tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_team_member", {
    p_member_id: parsed.data.memberId,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/team");
  revalidatePath("/admin/users");
  return { success: true, data: undefined };
}
