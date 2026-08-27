/**
 * Definisi 7 tahap alur reviu SIRVIU. Ini adalah heart of the system —
 * lihat brief §5 dan §"Catatan Akhir" #5. Jangan duplikasi logika ini di
 * komponen; import dari sini.
 */
import type { DocumentAssignees, Role, Stage } from "@/lib/types/domain";

export interface StageDefinition {
  id: Stage;
  /** Nama tahap dalam Bahasa Indonesia, dipakai untuk badge & timeline. */
  name: string;
  /**
   * Role yang memegang aksi di tahap ini. `null` untuk stage 7 (final,
   * tidak ada aksi lagi).
   */
  holderRole: Role | null;
  /**
   * Field di `documents` yang berisi id user pemegang tahap ini.
   * `null` untuk stage 7.
   */
  assigneeField: keyof DocumentAssignees | null;
  /** Tahap ini adalah tahap "upload" (dipegang Ketua Tim: 1, 3, 5). */
  isUploadStage: boolean;
  /** Tahap ini adalah tahap "reviu" dengan approve/reject (2, 4). */
  isReviewStage: boolean;
  /** Tahap ini adalah tahap operator dengan opsi finalize (6). */
  isOperatorStage: boolean;
  /** Tahap ini adalah tahap terminal — dokumen sudah final (7). */
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
    name: "Tindak Lanjut Reviu Dalnis",
    holderRole: "ketua_tim",
    assigneeField: "ketuaTimId",
    isUploadStage: true,
    isReviewStage: false,
    isOperatorStage: false,
    isTerminal: false,
  },
  4: {
    id: 4,
    name: "Reviu Mutu",
    holderRole: "dalmut",
    assigneeField: "dalmutId",
    isUploadStage: false,
    isReviewStage: true,
    isOperatorStage: false,
    isTerminal: false,
  },
  5: {
    id: 5,
    name: "Tindak Lanjut Reviu Dalmut",
    holderRole: "ketua_tim",
    assigneeField: "ketuaTimId",
    isUploadStage: true,
    isReviewStage: false,
    isOperatorStage: false,
    isTerminal: false,
  },
  6: {
    id: 6,
    name: "Format & Cetak",
    holderRole: "operator",
    assigneeField: "operatorId",
    isUploadStage: false,
    isReviewStage: false,
    isOperatorStage: true,
    isTerminal: false,
  },
  7: {
    id: 7,
    name: "Selesai (Dokumen Final)",
    holderRole: null,
    assigneeField: null,
    isUploadStage: false,
    isReviewStage: false,
    isOperatorStage: false,
    isTerminal: true,
  },
};

export const ALL_STAGES: readonly Stage[] = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Tahap tujuan saat `submit`/`approve` maju. Stage 6 tidak masuk di sini —
 * kelulusannya lewat `finalize`/`format_fix`, bukan skema +1 sederhana,
 * meski hasil akhirnya tetap 7.
 */
export const NEXT_STAGE: Record<1 | 2 | 3 | 4 | 5, Stage> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
};

/**
 * Target stage yang valid untuk aksi reject/"kembalikan untuk revisi",
 * per tahap reviewer. Brief §5.2.
 */
export const VALID_REJECT_TARGETS: Record<2 | 4 | 6, readonly Stage[]> = {
  2: [1],
  4: [1, 2, 3],
  6: [1, 2, 3, 4, 5],
};

/**
 * Default target stage yang di-pre-select di dropdown modal reject —
 * "stage terakhir sebelumnya" (DESIGN_BRIEF §5.7).
 */
export function getDefaultRejectTarget(fromStage: 2 | 4 | 6): Stage {
  const targets = VALID_REJECT_TARGETS[fromStage];
  return targets[targets.length - 1];
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
  format_fix: "Perbaikan Format",
  finalize: "Difinalisasi",
  upload_revision: "Versi Revisi Diupload",
  cancel: "Dibatalkan",
};

export function getStage(stage: Stage): StageDefinition {
  return STAGE_DEFINITIONS[stage];
}
