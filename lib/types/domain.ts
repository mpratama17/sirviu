/**
 * Domain types untuk SIRVIU — Sistem Informasi Reviu Berjenjang.
 *
 * File ini adalah sumber kebenaran untuk tipe-tipe yang merepresentasikan
 * konsep bisnis (role, stage, status, action), terpisah dari tipe hasil
 * generate Supabase (`lib/types/database.ts`).
 */

/** Role yang bisa dimiliki seorang user. Satu user bisa punya lebih dari satu. */
export type Role = "ketua_tim" | "dalnis" | "dalmut" | "operator" | "admin";

export const ALL_ROLES: readonly Role[] = [
  "ketua_tim",
  "dalnis",
  "dalmut",
  "operator",
  "admin",
] as const;

/** Nomor tahap alur reviu, 1 sampai 7. Lihat `lib/constants/stages.ts`. */
export type Stage = 1 | 2 | 3 | 4 | 5;

/** Status keseluruhan dokumen (independen dari nomor stage). */
export type DocumentStatus =
  | "in_progress"
  | "revision_requested"
  | "finalized"
  | "cancelled";

/**
 * Jenis aksi yang tercatat di `stage_transitions`. Append-only audit trail —
 * lihat brief §6.6.
 */
export type TransitionAction =
  | "submit"
  | "approve"
  | "reject"
  | "format_fix"
  | "finalize"
  | "upload_revision"
  | "cancel";

/** Subset field dokumen yang dibutuhkan logika permission/state-machine. */
export interface DocumentAssignees {
  submitterId: string;
  ketuaTimId: string;
  dalnisId: string;
  dalmutId: string;
  operatorId: string;
}

export interface MinimalDocument extends DocumentAssignees {
  id: string;
  currentStage: Stage;
  status: DocumentStatus;
}

/** Subset field transition yang dibutuhkan untuk cek eligibility hapus dokumen. */
export interface MinimalTransition {
  action: TransitionAction;
}
