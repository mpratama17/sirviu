"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectReviewSchema, approveReviewSchema } from "@/lib/validators/reviews";
import { validateUploadFile } from "@/lib/validators/documents";
import type { ActionResult } from "@/lib/types/action-result";

/**
 * Semua fungsi di sini memanggil RPC lewat session client user (bukan
 * admin) — actor_id di-derive dari auth.uid() di dalam RPC, permission
 * check ada di sana juga. Lihat AGENTS.md & migration ...000004.
 *
 * revalidatePath dipanggil di setiap aksi supaya detail page & dashboard
 * tidak nyangkut di RSC cache lama setelah mutasi (Next.js router cache).
 */

function revalidateDocument(documentId: string) {
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/dashboard");
}

export async function submitDocument(documentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_document", {
    p_document_id: documentId,
  });
  if (error) return { success: false, error: error.message };
  revalidateDocument(documentId);
  return { success: true, data: undefined };
}

export async function approveReview(
  documentId: string,
  rawComment: string,
): Promise<ActionResult> {
  const parsed = approveReviewSchema.safeParse({ comment: rawComment });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_review", {
    p_document_id: documentId,
    p_comment: parsed.data.comment || null,
  });
  if (error) return { success: false, error: error.message };
  revalidateDocument(documentId);
  return { success: true, data: undefined };
}

export async function rejectReview(
  documentId: string,
  rawTargetStage: number,
  rawComment: string,
): Promise<ActionResult> {
  const parsed = rejectReviewSchema.safeParse({
    targetStage: rawTargetStage,
    comment: rawComment,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_review", {
    p_document_id: documentId,
    p_target_stage: parsed.data.targetStage,
    p_comment: parsed.data.comment,
  });
  if (error) return { success: false, error: error.message };
  revalidateDocument(documentId);
  return { success: true, data: undefined };
}

export async function finalizeDocument(
  documentId: string,
  rawComment?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_document", {
    p_document_id: documentId,
    p_comment: rawComment?.trim() || null,
  });
  if (error) return { success: false, error: error.message };
  revalidateDocument(documentId);
  return { success: true, data: undefined };
}

/**
 * Format Fix & Finalize (brief §5.3.2) — Operator upload versi hasil
 * perbaikan format, lalu langsung finalize. Sama urutan dengan
 * createDocument: upload storage dulu (admin client, storage tidak punya
 * INSERT policy untuk authenticated), baru panggil RPC. version_number
 * dihitung di sini untuk path storage, tapi RPC re-derive max+1 sendiri
 * secara otoritatif — lihat komentar di migration ...000004.
 */
export async function formatFixAndFinalize(
  documentId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return { success: false, error: "Sesi Anda berakhir. Silakan login ulang." };
  }

  const file = formData.get("file");
  const fileCheck = validateUploadFile(file instanceof File ? file : null);
  if (!fileCheck.valid) {
    return { success: false, error: fileCheck.error };
  }
  const uploadedFile = file as File;
  const comment = (formData.get("comment") as string | null)?.trim() || null;

  const admin = createAdminClient();
  const { count: versionCount } = await admin
    .from("document_versions")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId);
  const nextVersion = (versionCount ?? 0) + 1;

  const sanitizedFileName = uploadedFile.name.replace(/[^\w.\-]+/g, "_");
  const filePath = `${documentId}/v${nextVersion}/${sanitizedFileName}`;

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(filePath, uploadedFile, {
      contentType: uploadedFile.type,
      upsert: false,
    });
  if (uploadError) {
    return { success: false, error: `Gagal upload file: ${uploadError.message}` };
  }

  const { error: rpcError } = await supabase.rpc("format_fix_and_finalize", {
    p_document_id: documentId,
    p_file_path: filePath,
    p_file_name: uploadedFile.name,
    p_file_size: uploadedFile.size,
    p_mime_type: uploadedFile.type,
    p_comment: comment,
  });

  if (rpcError) {
    await admin.storage.from("documents").remove([filePath]);
    return { success: false, error: rpcError.message };
  }

  revalidateDocument(documentId);
  return { success: true, data: undefined };
}
