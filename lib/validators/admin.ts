import { z } from "zod";

// Tuple literal terpisah dari ALL_ROLES (lib/types/domain.ts) karena
// z.enum butuh tuple literal type, bukan `readonly Role[]` yang lebih umum.
const ROLE_VALUES = ["ketua_tim", "dalnis", "dalmut", "operator", "admin"] as const;

export const addUserSchema = z.object({
  email: z.email("Format email tidak valid."),
  name: z.string().trim().min(1, "Nama wajib diisi.").max(200),
  roles: z.array(z.enum(ROLE_VALUES)).min(1, "Pilih minimal satu role."),
});

export type AddUserInput = z.infer<typeof addUserSchema>;

export const editUserSchema = z.object({
  userId: z.uuid(),
  name: z.string().trim().min(1, "Nama wajib diisi.").max(200),
  roles: z.array(z.enum(ROLE_VALUES)).min(1, "Pilih minimal satu role."),
  isActive: z.boolean(),
});

export type EditUserInput = z.infer<typeof editUserSchema>;
