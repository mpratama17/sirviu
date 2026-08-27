/**
 * Zod schema untuk form & server action dokumen. Dipakai di client
 * (react-hook-form resolver) dan di server action (re-validate — jangan
 * pernah percaya input client, brief §11).
 */
import { z } from "zod";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, brief §6.4

const uuid = z.uuid({ message: "Pilih salah satu dari daftar." });

/** Metadata dokumen — bagian form yang bukan file. */
export const documentMetadataSchema = z.object({
  nomorSuratTugas: z
    .string()
    .trim()
    .min(1, "Nomor surat tugas wajib diisi.")
    .max(200, "Nomor surat tugas maksimal 200 karakter."),
  namaLaporan: z
    .string()
    .trim()
    .min(1, "Nama laporan wajib diisi.")
    .max(300, "Nama laporan maksimal 300 karakter."),
  ketuaTimId: uuid,
  dalnisId: uuid,
  dalmutId: uuid,
  operatorId: uuid,
  uploadNotes: z
    .string()
    .trim()
    .max(2000, "Catatan maksimal 2000 karakter.")
    .optional()
    .or(z.literal("")),
});

export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;

/**
 * Validasi file di server (client-side check di file-dropzone.tsx pakai
 * aturan yang sama, tapi tidak bisa dipercaya — file bisa datang dari
 * request yang di-construct manual).
 */
export function validateUploadFile(
  file: File | null,
): { valid: true } | { valid: false; error: string } {
  if (!file || file.size === 0) {
    return { valid: false, error: "File dokumen wajib diupload." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "File terlalu besar. Maksimal 10 MB — silakan kompres file.",
    };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: "Format file tidak didukung. Gunakan PDF atau Word (.docx).",
    };
  }
  return { valid: true };
}
