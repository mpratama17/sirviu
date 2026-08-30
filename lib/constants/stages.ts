/**
 * Definisi 5 tahap alur reviu SIRVIU. Migration Aug 2026 mengubah dari
 * 7-stage ke 5-stage berdasarkan feedback calon-user (KT): reviewer bisa
 * revisi sendiri lalu forward tanpa balik ke KT; reject dari Dalmut ke
 * Dalnis, dari Operator ke Dalmut.
 *
 * Ini adalah heart of the system — jangan duplikasi logika ini di
 * komponen; import dari sini.
 */
import type { DocumentAssignees, Role, Stage } from "@/lib/types/domain";

export interface StageDefinition {
  id: Stage;
  /** Nama tahap dalam Bahasa Indonesia, dipakai untuk badge & timeline. */
  name: string;
  /**
   * Role yang memegang aksi di tahap ini. `null` untuk stage 5 (final,
   * tidak ada aksi lagi).
   */
  holderRole: Role | null;
  /**
   * Field di `documents` yang berisi id user pemegang tahap ini.
   * `null` untuk stage 5.
   */
  assigneeField: keyof DocumentAssignees | null;
  /** Tahap upload (KT: 1). */
  isUploadStage: boolean;
  /** Tahap reviu (Dalnis: 2, Dalmut: 3) — approve/revisi/reject. */
  isReviewStage: boolean;
  /** Tahap operator (finalize/format_fix): 4. */
  isOperatorStage: boolean;
  /** Tahap terminal — dokumen sudah final: 5. */
  isTerminal: boolean;
}

export const STAGE_DEFINITIONS: Record<Stage, StageDefinition> = {
  1: {
    id: 1,
    name: "Penyusunan Draft",
    holderRole: "ketua_tim",
    assigneeField: "ketuaTimId",
    isUploadStage: true,
    isReviewStage: false,
    isOperatorStage: false,
    isTerminal: false,
  },
  2: {
    id: 2,
    name: "Reviu Teknis",
    holderRole: "dalnis",
    assigneeField: "dalnisId",
    isUploadStage: false,
    isReviewStage: true,
    isOperatorStage: false,
    isTerminal: false,
  },
  3: {
    id: 3,
    name: "Reviu Mutu",
    holderRole: "dalmut",
    assigneeField: "dalmutId",
    isUploadStage: false,
    isReviewStage: true,
    isOperatorStage: false,
    isTerminal: false,
  },
  4: {
    id: 4,
    name: "Format & Cetak",
    holderRole: "operator",
    assigneeField: "operatorId",
    isUploadStage: false,
    isReviewStage: false,
    isOperatorStage: true,
    isTerminal: false,
  },
  5: {
    id: 5,
    name: "Selesai (Dokumen Final)",
    holderRole: null,
    assigneeField: null,
    isUploadStage: false,
    isReviewStage: false,
    isOperatorStage: false,
    isTerminal: true,
  },
};

export const ALL_STAGES: readonly Stage[] = [1, 2, 3, 4, 5] as const;

/**
 * Tahap yang termasuk "reviewer/finalize" di dashboard KPI "Sedang Direviu".
 */
export const REVIEW_STAGES: readonly Stage[] = [2, 3, 4] as const;

/**
 * Target stage yang valid untuk aksi reject/"kembalikan untuk revisi".
 * Reject selalu ke reviewer sebelumnya (atau KT dari Dalnis).
 * - Stage 2 (Dalnis) → 1 (KT upload ulang)
 * - Stage 3 (Dalmut) → 2 (Dalnis re-review)
 * - Stage 4 (Operator) → 3 (Dalmut re-review)
 */
export const VALID_REJECT_TARGETS: Record<2 | 3 | 4, readonly Stage[]> = {
  2: [1],
  3: [2],
  4: [3],
};

/**
 * Default target stage yang di-pre-select di dropdown modal reject.
 * Di workflow 5-stage baru cuma ada satu opsi per stage, jadi ini
 * selalu return elemen tunggal.
 */
export function getDefaultRejectTarget(fromStage: 2 | 3 | 4): Stage {
  return VALID_REJECT_TARGETS[fromStage][0];
}

/** Label status dokumen dalam Bahasa Indonesia untuk badge. */
export const STATUS_LABELS: Record<string, string> = {
  in_progress: "Sedang Direviu",
  revision_requested: "Menunggu Revisi",
  finalized: "Dokumen Final",
  cancelled: "Dibatalkan",
};

/** Label aksi (untuk audit trail & timeline) dalam Bahasa Indonesia. */
export const ACTION_LABELS: Record<string, string> = {
  submit: "Diserahkan ke Tahap Berikutnya",
  approve: "Disetujui",
  reject: "Dikembalikan untuk Revisi",
  revise_and_forward: "Direvisi & Diteruskan",
  format_fix: "Perbaikan Format",
  finalize: "Difinalisasi",
  upload_revision: "Versi Revisi Diupload",
  cancel: "Dibatalkan",
};

export function getStage(stage: Stage): StageDefinition {
  return STAGE_DEFINITIONS[stage];
}
