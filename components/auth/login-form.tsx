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
import { signInSchema, type SignInInput } from "@/lib/validators/auth";

export function LoginForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInInput) {
    setServerError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    setIsSubmitting(false);

    if (error) {
      setServerError(
        error.message === "Invalid login credentials"
          ? "Email atau password salah."
          : error.message,
      );
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" autoComplete="email" {...register("email")} />
        {errors.email ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-password">Password</Label>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.password.message}
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
        Masuk
      </Button>
    </form>
  );
}
