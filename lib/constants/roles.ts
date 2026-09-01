/** Label role dalam Bahasa Indonesia, dipakai di badge/dropdown/form. */
import type { Role } from "@/lib/types/domain";

export const ROLE_LABELS: Record<Role, string> = {
  ketua_tim: "Ketua Tim",
  dalnis: "Pengendali Teknis",
  // Istilah resmi Inspektorat, permintaan user (1 Sep 2026) — role/kolom DB
  // tetap "dalmut", cuma label tampilan yang berubah.
  dalmut: "Irban (Pengendali Mutu)",
  operator: "Operator",
  admin: "Admin",
};
