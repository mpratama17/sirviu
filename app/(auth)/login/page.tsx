import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            SIRVIU
          </span>
          <p className="text-sm text-muted-foreground">
            Sistem Informasi Reviu Berjenjang
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <GoogleSignInButton />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-text-muted">atau</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <LoginForm />

          {error ? (
            <p role="alert" className="text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <p className="text-center text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Daftar
            </Link>
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} Inspektorat — Internal use only.
      </p>
    </div>
  );
}
