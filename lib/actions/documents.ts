"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { documentMetadataSchema, validateUploadFile } from "@/lib/validators/documents";
import type { ActionResult } from "@/lib/types/action-result";

/**
 * Upload dokumen baru (Milestone 2). Alur:
 * 1. Validasi metadata (zod) + file (mime/size) — server-side, jangan
 *    percaya validasi client.
 * 2. Upload file ke storage DULU, baru insert DB rows — storage tidak
 *    transactional dengan Postgres. Kalau upload gagal, tidak ada row DB
 *    yang nunjuk ke file yang tidak ada. Kalau insert DB gagal setelah
 *    upload sukses, file jadi orphan (harmless garbage, size prototipe ini
 *    kecil) — dicoba di-cleanup, tapi kegagalan cleanup tidak diperlakukan
 *    sebagai error ke user.
 * 3. Upload storage pakai admin client (service role) karena
 *    storage.objects sengaja tidak punya INSERT policy untuk
 *    `authenticated` (brief §6.4 — validasi hanya boleh di server).
 * 4. Insert DB rows lewat RPC `create_document`, dipanggil dengan client
 *    session user (bukan admin) — actor_id di-derive dari auth.uid() di
 *    dalam function, tidak dari parameter yang bisa dipalsukan. Lihat
 *    AGENTS.md.
 */
export async function createDocument(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return { success: false, error: "Sesi Anda berakhir. Silakan login ulang." };
  }

  const rawMetadata = {
    nomorSuratTugas: formData.get("nomorSuratTugas"),
    namaLaporan: formData.get("namaLaporan"),
    ketuaTimId: formData.get("ketuaTimId"),
    dalnisId: formData.get("dalnisId"),
    dalmutId: formData.get("dalmutId"),
    operatorId: formData.get("operatorId"),
    uploadNotes: formData.get("uploadNotes") ?? "",
  };

  const parsed = documentMetadataSchema.safeParse(rawMetadata);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data form tidak valid.",
    };
  }

  const file = formData.get("file");
  const fileCheck = validateUploadFile(file instanceof File ? file : null);
  if (!fileCheck.valid) {
    return { success: false, error: fileCheck.error };
  }
  const uploadedFile = file as File;

  const documentId = randomUUID();
  const sanitizedFileName = uploadedFile.name.replace(/[^\w.\-]+/g, "_");
  const filePath = `${documentId}/v1/${sanitizedFileName}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(filePath, uploadedFile, {
      contentType: uploadedFile.type,
      upsert: false,
    });

  if (uploadError) {
    return {
      success: false,
      error: `Gagal upload file: ${uploadError.message}`,
    };
  }

  const { data, error: rpcError } = await supabase.rpc("create_document", {
    p_document_id: documentId,
    p_nomor_surat_tugas: parsed.data.nomorSuratTugas,
    p_nama_laporan: parsed.data.namaLaporan,
    p_ketua_tim_id: parsed.data.ketuaTimId,
    p_dalnis_id: parsed.data.dalnisId,
    p_dalmut_id: parsed.data.dalmutId,
    p_operator_id: parsed.data.operatorId,
    p_file_path: filePath,
    p_file_name: uploadedFile.name,
    p_file_size: uploadedFile.size,
    p_mime_type: uploadedFile.type,
    p_upload_notes: parsed.data.uploadNotes || null,
  });

  if (rpcError || !data) {
    // Best-effort cleanup — file jadi orphan kalau ini gagal, tidak fatal.
    await admin.storage.from("documents").remove([filePath]);
    return {
      success: false,
      error: rpcError?.message ?? "Gagal membuat dokumen.",
    };
  }

  return { success: true, data: { id: data.id } };
}
