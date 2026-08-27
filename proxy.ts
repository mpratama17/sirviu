/**
 * Next.js 16 "Proxy" (dulu bernama Middleware — lihat AGENTS.md). Refresh
 * session Supabase & redirect ke /login bila belum authenticated.
 * Logic sebenarnya ada di lib/supabase/middleware.ts.
 */
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Jalankan proxy di semua path kecuali:
     * - _next/static, _next/image (asset build)
     * - favicon.ico
     * - file gambar statis lain
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
