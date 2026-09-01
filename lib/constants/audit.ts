import { STAGE_DEFINITIONS } from "@/lib/constants/stages";
import type { Role, Stage } from "@/lib/types/domain";

/**
 * "Peran" aktor di audit trail di-derive dari from_stage transisi itu
 * sendiri, BUKAN dari roles global user (yang bisa multi-role) — supaya
 * setiap baris audit menunjukkan peran yang benar-benar dipakai saat itu.
 *
 * Diambil dari STAGE_DEFINITIONS (lib/constants/stages.ts) — bukan
 * hardcode 1/2/3/4/5/6 sendiri di sini. Sebelumnya file ini masih pakai
 * mapping 7-stage lama (fromStage 3→ketua_tim, 4→dalmut, 6→operator)
 * peninggalan sebelum migrasi ke 5-stage, jadi salah menampilkan role di
 * halaman /admin/audit untuk setiap approve di stage 3/4 — ditemukan saat
 * menyiapkan panduan pengguna, dikonfirmasi lewat stage_transitions.actor_id
 * (yang sebenarnya sudah benar sejak awal — cuma label role di UI-nya
 * yang salah).
 */
export function roleForTransition(fromStage: number | null): Role | null {
  // from_stage null = transisi submit pertama (dokumen belum masuk stage
  // manapun), selalu dilakukan Ketua Tim.
  if (fromStage === null) return "ketua_tim";
  return STAGE_DEFINITIONS[fromStage as Stage]?.holderRole ?? null;
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
