/**
 * Zod schema untuk aksi reviu (DESIGN_BRIEF §5.6/§5.7). Min 10 karakter di
 * komentar reject adalah kebijakan UI — RPC di database cuma menegakkan
 * "tidak boleh kosong" (brief §6.3). Jangan disamakan; UI boleh lebih
 * ketat dari data layer, bukan sebaliknya.
 */
import { z } from "zod";

export const rejectReviewSchema = z.object({
  targetStage: z.coerce
    .number()
    .int()
    .min(1)
    .max(6, { message: "Pilih stage tujuan." }),
  comment: z
    .string()
    .trim()
    .min(10, "Alasan revisi minimal 10 karakter.")
    .max(2000, "Alasan revisi maksimal 2000 karakter."),
});

export type RejectReviewInput = z.infer<typeof rejectReviewSchema>;

export const approveReviewSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(2000, "Catatan maksimal 2000 karakter.")
    .optional()
    .or(z.literal("")),
});

export type ApproveReviewInput = z.infer<typeof approveReviewSchema>;
