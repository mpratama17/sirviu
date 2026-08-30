/**
 * Refresh session Supabase & route-guard dasar. Dipanggil dari `proxy.ts`
 * di root project — di Next.js 16 file ini bernama `proxy.ts` (bukan
 * `middleware.ts`), lihat AGENTS.md untuk detail rename middleware→proxy.
 * Nama helper ini sengaja tetap "middleware" karena itu istilah domain
 * Supabase-nya, terlepas dari nama file Next.js yang memanggilnya.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/auth/callback", "/auth/magic-callback"];

/**
 * Path yang boleh diakses user yang sudah authenticated tapi belum memilih
 * role di onboarding (roles = []). Selain path-path ini, kita tendang ke
 * `/onboarding/role`.
 */
const ONBOARDING_ALLOWED_PATHS = ["/onboarding/role"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // WAJIB dipanggil sebelum response dibuat — ini yang men-trigger refresh
  // token bila perlu. getClaims() lebih murah dari getUser() karena
  // verifikasi JWT lokal (lihat JSDoc @supabase/auth-js).
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = data !== null;

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  // Onboarding guard: authenticated user tanpa role apapun harus pilih role
  // dulu di `/onboarding/role`. Lookup DB kecil per request (indexed by id) —
  // kita batasi hanya untuk path yang bukan onboarding/public/asset, jadi
  // tidak menyentuh request static asset.
  if (
    isAuthenticated &&
    !isPublicPath &&
    !ONBOARDING_ALLOWED_PATHS.includes(pathname)
  ) {
    const userId = data?.claims.sub;
    if (userId) {
      const { data: profile } = await supabase
        .from("users")
        .select("roles")
        .eq("id", userId)
        .maybeSingle();
      const hasRole = (profile?.roles ?? []).length > 0;
      if (!hasRole) {
        const onboardingUrl = request.nextUrl.clone();
        onboardingUrl.pathname = "/onboarding/role";
        onboardingUrl.search = "";
        return NextResponse.redirect(onboardingUrl);
      }
    }
  }

  return response;
}
