/** Label role dalam Bahasa Indonesia, dipakai di badge/dropdown/form. */
import type { Role } from "@/lib/types/domain";

export const ROLE_LABELS: Record<Role, string> = {
  ketua_tim: "Ketua Tim",
  dalnis: "Pengendali Teknis",
  dalmut: "Pengendali Mutu",
  operator: "Operator",
  admin: "Admin",
};
