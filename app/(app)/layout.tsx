import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/supabase/session";

/**
 * Layout untuk semua halaman setelah login. `proxy.ts` sudah menjamin kita
 * di sini hanya kalau JWT valid (authenticated) — jadi kalau
 * `getCurrentUser()` tetap `null`, itu BUKAN "belum login", tapi "login
 * valid tapi row public.users belum ada" (race trigger signup, atau
 * migration belum di-push). JANGAN redirect ke /login di sini: proxy.ts
 * redirect authenticated user dari /login balik ke /dashboard, jadi
 * redirect ke /login akan infinite loop. Render state eksplisit saja.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <Loader2 className="size-8 animate-spin text-text-muted" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Profil Anda belum tersinkron.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Muat ulang halaman ini. Kalau masih terjadi, hubungi admin.
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm font-medium text-primary hover:underline"
          >
            Keluar dan coba lagi
          </button>
        </form>
      </div>
    );
  }

  return <AppShell user={user}>{children}</AppShell>;
}
