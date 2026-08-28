import type { Role } from "@/lib/types/domain";

/**
 * "Peran" aktor di audit trail di-derive dari from_stage transisi itu
 * sendiri, BUKAN dari roles global user (yang bisa multi-role) — supaya
 * setiap baris audit menunjukkan peran yang benar-benar dipakai saat itu.
 */
export function roleForTransition(fromStage: number | null): Role | null {
  if (fromStage === null || fromStage === 1 || fromStage === 3 || fromStage === 5) {
    return "ketua_tim";
  }
  if (fromStage === 2) return "dalnis";
  if (fromStage === 4) return "dalmut";
  if (fromStage === 6) return "operator";
  return null;
}

export const AUDIT_ACTIONS = [
  "submit",
  "approve",
  "reject",
  "format_fix",
  "finalize",
  "upload_revision",
  "cancel",
] as const;
