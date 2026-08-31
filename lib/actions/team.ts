"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/action-result";

/**
 * Keanggotaan tim (Ketua Tim ↔ dalnis/dalmut/operator) — masukan user
 * setelah testing, lihat AGENTS.md. Self-service oleh Ketua Tim sendiri,
 * lewat RPC `assign_team_member`/`remove_team_member` (security definer,
 * trust boundary sebenarnya — actor & semua guard "sudah di tim lain?"
 * dicek ulang di dalam RPC, jangan andalkan validasi di sini saja).
 */
const memberIdSchema = z.object({ memberId: z.uuid() });

export async function addTeamMember(memberId: string): Promise<ActionResult> {
  const parsed = memberIdSchema.safeParse({ memberId });
  if (!parsed.success) {
    return { success: false, error: "User tidak valid." };
  }

  const supabase = await createClient();
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
  return { success: true, data: undefined };
}
