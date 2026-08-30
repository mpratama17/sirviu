/**
 * Helper permission untuk state machine dokumen. Semua fungsi di sini pure
 * (tidak melakukan I/O) supaya bisa dipakai baik di client (untuk
 * show/hide UI) maupun di server actions (sebagai guard sebelum mutasi).
 *
 * PENTING: fungsi-fungsi ini adalah lapisan UX, bukan pengganti RLS.
 * Server actions tetap wajib re-validate karena RLS + service role bypass
 * client trust boundary. Lihat brief §7.
 */
import {
  STAGE_DEFINITIONS,
  VALID_REJECT_TARGETS,
} from "@/lib/constants/stages";
import type {
  MinimalDocument,
  MinimalTransition,
  Role,
  Stage,
} from "@/lib/types/domain";

/** Id user yang menjadi assignee tahap saat ini pada dokumen, atau `null` (stage 7). */
export function getCurrentStageAssigneeId(doc: MinimalDocument): string | null {
  const field = STAGE_DEFINITIONS[doc.currentStage].assigneeField;
  return field ? doc[field] : null;
}

/** Apakah `userId` adalah pemegang tahap saat ini pada dokumen ini. */
export function isAssignedToCurrentStage(
  doc: MinimalDocument,
  userId: string,
): boolean {
  return getCurrentStageAssigneeId(doc) === userId;
}

/**
 * Ketua Tim di stage 1/3/5, status `in_progress` → boleh submit ke tahap
 * berikutnya. `isAdmin` (deviation dari brief §7, lihat AGENTS.md) meloloskan
 * siapa pun dengan role admin bertindak sebagai pemegang stage — state
 * machine (stage/status check) TIDAK dilonggarkan, cuma syarat kepemilikan.
 */
export function canSubmit(
  doc: MinimalDocument,
  userId: string,
  isAdmin = false,
): boolean {
  const stage = STAGE_DEFINITIONS[doc.currentStage];
  return (
    stage.isUploadStage &&
    doc.status === "in_progress" &&
    (doc.ketuaTimId === userId || isAdmin)
  );
}

/**
 * Ketua Tim di stage 1/3/5, status `revision_requested` → boleh upload
 * versi baru. Selalu KT karena hanya stage 1/3/5 yang punya aksi upload
 * (brief §6.1) — tidak ada kasus reject mengarah ke stage non-upload.
 */
export function canUploadRevision(
  doc: MinimalDocument,
  userId: string,
  isAdmin = false,
): boolean {
  const stage = STAGE_DEFINITIONS[doc.currentStage];
  return (
    stage.isUploadStage &&
    doc.status === "revision_requested" &&
    (doc.ketuaTimId === userId || isAdmin)
  );
}

/** Dalnis di stage 2 atau Dalmut di stage 4, status `in_progress` → boleh approve. */
export function canApprove(
  doc: MinimalDocument,
  userId: string,
  isAdmin = false,
): boolean {
  const stage = STAGE_DEFINITIONS[doc.currentStage];
  return (
    stage.isReviewStage &&
    doc.status === "in_progress" &&
    (isAssignedToCurrentStage(doc, userId) || isAdmin)
  );
}

/**
 * Dalnis/Dalmut/Operator (stage 2, 4, 6) status `in_progress` → boleh
 * reject ("kembalikan untuk revisi").
 */
export function canReject(
  doc: MinimalDocument,
  userId: string,
  isAdmin = false,
): boolean {
  const stage = STAGE_DEFINITIONS[doc.currentStage];
  const isRejectableStage = stage.isReviewStage || stage.isOperatorStage;
  return (
    isRejectableStage &&
    doc.status === "in_progress" &&
    (isAssignedToCurrentStage(doc, userId) || isAdmin)
  );
}

/** Operator di stage 6, status `in_progress` → boleh finalize atau format-fix. */
export function canFinalize(
  doc: MinimalDocument,
  userId: string,
  isAdmin = false,
): boolean {
  const stage = STAGE_DEFINITIONS[doc.currentStage];
  return (
    stage.isOperatorStage &&
    doc.status === "in_progress" &&
    (doc.operatorId === userId || isAdmin)
  );
}

/** Alias semantik — form action-nya beda (upload dulu) tapi guard-nya sama. */
export const canFormatFix = canFinalize;

/** Target stage yang valid untuk reject dari stage saat ini. `[]` bila tidak reviewable. */
export function getValidRejectTargets(currentStage: Stage): readonly Stage[] {
  if (currentStage === 2 || currentStage === 3 || currentStage === 4) {
    return VALID_REJECT_TARGETS[currentStage];
  }
  return [];
}

/**
 * Dalnis (stage 2) atau Dalmut (stage 3) — bisa revisi sendiri (upload
 * versi baru) lalu forward ke reviewer berikutnya dalam satu aksi.
 * Pola sama seperti canApprove; RPC `reviewer_revise_and_forward`.
 * Ditambahkan Aug 2026 saat migrasi ke workflow 5-stage.
 */
export function canRevise(
  doc: MinimalDocument,
  userId: string,
  isAdmin = false,
): boolean {
  const stage = STAGE_DEFINITIONS[doc.currentStage];
  return (
    stage.isReviewStage &&
    doc.status === "in_progress" &&
    (isAssignedToCurrentStage(doc, userId) || isAdmin)
  );
}

/**
 * Apakah `userId` bisa melihat dokumen ini — mirror dari RLS policy
 * `documents.SELECT` (brief §7). Dipakai untuk keputusan UI (mis. filter
 * "Peran Saya" di dashboard); bukan pengganti RLS di server.
 */
export function canViewDocument(
  doc: MinimalDocument,
  userId: string,
  userRoles: readonly Role[],
): boolean {
  if (doc.status === "finalized") return true;
  if (userRoles.includes("admin")) return true;
  return (
    doc.submitterId === userId ||
    doc.ketuaTimId === userId ||
    doc.dalnisId === userId ||
    doc.dalmutId === userId ||
    doc.operatorId === userId
  );
}

/**
 * Hard delete hanya boleh oleh submitter, hanya di stage 1, dan hanya
 * sebelum pernah di-submit (brief §6.2). `transitions` harus berisi
 * seluruh riwayat transition dokumen ini.
 */
export function canHardDelete(
  doc: MinimalDocument,
  userId: string,
  transitions: readonly MinimalTransition[],
): boolean {
  if (doc.submitterId !== userId) return false;
  if (doc.currentStage !== 1) return false;
  return !transitions.some((t) => t.action !== "submit");
}

/**
 * Admin hard-delete (deviation dari brief, lihat AGENTS.md & migration
 * ...000007) — berbeda dari `canHardDelete` di atas (yang khusus submitter
 * sendiri, stage 1, belum pernah disubmit). Admin boleh hapus dokumen
 * APAPUN di stage/status manapun; satu-satunya syarat adalah role admin
 * itu sendiri, ditegakkan lagi di RPC `admin_delete_document`.
 */
export function canAdminDelete(userRoles: readonly Role[]): boolean {
  return userRoles.includes("admin");
}

/** Peran efektif user pada dokumen ini ("KT" / "Dalnis" / dst), untuk kolom "Peran Saya". */
export function getUserRoleOnDocument(
  doc: MinimalDocument,
  userId: string,
): Role | null {
  if (doc.ketuaTimId === userId) return "ketua_tim";
  if (doc.dalnisId === userId) return "dalnis";
  if (doc.dalmutId === userId) return "dalmut";
  if (doc.operatorId === userId) return "operator";
  return null;
}
