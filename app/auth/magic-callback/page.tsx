"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function parseTokensFromHash(): { accessToken: string; refreshToken: string } | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

/**
 * Handler untuk link yang dibuat via `admin.generateLink()` (magic link,
 * invite, dsb) — API itu selalu mengembalikan token di URL FRAGMENT
 * (`#access_token=...&refresh_token=...`), beda dari OAuth Google yang
 * pakai PKCE (`?code=...`, ditangani `app/auth/callback/route.ts`).
 *
 * Fragment tidak pernah terkirim ke server, jadi ini WAJIB client
 * component yang baca `window.location.hash`, bukan Route Handler.
 * Dipakai untuk testing multi-user (lihat percakapan) — bukan bagian
 * dari alur login normal aplikasi (yang hanya Google OAuth, brief §2).
 */
export default function MagicCallbackPage() {
  const router = useRouter();
  const [tokens] = useState(parseTokensFromHash);
  const [error, setError] = useState<string | null>(() =>
    tokens ? null : "Link tidak valid atau sudah kedaluwarsa.",
  );

  useEffect(() => {
    if (!tokens) return;

    const supabase = createClient();
    supabase.auth
      .setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        const next = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
        router.replace(next);
      });
  }, [tokens, router]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <Loader2 className="size-6 animate-spin text-text-muted" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Memproses login...</p>
        </>
      )}
    </div>
  );
}
