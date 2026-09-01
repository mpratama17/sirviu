import Link from "next/link";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="flex min-h-svh bg-background">
      <AuthBrandPanel />

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {/* Wordmark ringkas, cuma tampil saat brand panel tersembunyi (mobile/tablet). */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              S
            </div>
            <div className="leading-none">
              <div className="text-sm font-bold tracking-tight text-foreground">
                SIRVIU
              </div>
              <div className="mt-0.5 text-[11px] text-text-muted">
                Reviu Berjenjang LHP
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] font-semibold tracking-tight text-foreground">
              Selamat datang kembali
            </h1>
            <p className="text-sm text-muted-foreground">
              Masuk untuk melanjutkan reviu laporan Anda.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4">
            <GoogleSignInButton />

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-text-muted">atau masuk dengan email</span>
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

          <p className="mt-10 text-center text-xs text-text-muted lg:hidden">
            © {new Date().getFullYear()} Irban III — Internal use only.
          </p>
        </div>
      </div>
    </div>
  );
}
