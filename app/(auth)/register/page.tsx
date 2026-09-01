import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            SIRVIU
          </span>
          <p className="text-sm text-muted-foreground">Daftar akun baru</p>
        </div>

        <div className="mt-8">
          <RegisterForm />
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Masuk
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} Irban III — Internal use only.
      </p>
    </div>
  );
}
