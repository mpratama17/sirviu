/**
 * Callback OAuth Google. Supabase redirect ke sini dengan `?code=...` (PKCE
 * flow) setelah user approve consent di Google. Tukar code jadi session,
 * lalu redirect ke tujuan awal (`next`, default `/dashboard`).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set(
    "error",
    "Gagal masuk dengan Google. Silakan coba lagi.",
  );
  return NextResponse.redirect(loginUrl);
}
