import { z } from "zod";

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Nama wajib diisi.").max(200),
    email: z.email("Format email tidak valid."),
    password: z.string().min(8, "Password minimal 8 karakter."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email("Format email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

export type SignInInput = z.infer<typeof signInSchema>;
