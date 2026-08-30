"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";
import { signUpSchema, type SignUpInput } from "@/lib/validators/auth";

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: SignUpInput) {
    setServerError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    setIsSubmitting(false);

    if (error) {
      setServerError(error.message);
      return;
    }

    // `session` null + user tanpa email_confirmed_at berarti project butuh
    // konfirmasi email dulu sebelum bisa login (default Supabase, brief
    // tidak spesifik soal ini karena aslinya cuma Google OAuth).
    if (!data.session) {
      setConfirmationSent(true);
      return;
    }

    router.push("/dashboard");
  }

  if (confirmationSent) {
    return (
      <div className="rounded-md bg-secondary px-4 py-3 text-center text-sm text-foreground">
        Cek email Anda untuk konfirmasi akun sebelum login.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-name">Nama</Label>
        <Input id="register-name" autoComplete="name" {...register("name")} />
        {errors.name ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-email">Email</Label>
        <Input id="register-email" type="email" autoComplete="email" {...register("email")} />
        <p className="text-xs text-muted-foreground">
          Gunakan email asli (Gmail, dst). Domain internal seperti
          @sirviu.local hanya bisa didaftarkan Admin dari Manajemen Pengguna.
        </p>
        {errors.email ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-password">Password</Label>
        <PasswordInput
          id="register-password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-confirm-password">Konfirmasi Password</Label>
        <PasswordInput
          id="register-confirm-password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Daftar
      </Button>
    </form>
  );
}
