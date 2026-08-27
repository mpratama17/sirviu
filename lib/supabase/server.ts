/**
 * Supabase client untuk Server Components, Server Actions, dan Route
 * Handlers. Selalu buat instance BARU per request — jangan cache/reuse
 * lintas request.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Dipanggil dari Server Component render — cookies tidak bisa
            // di-set di sana. Aman diabaikan selama `proxy.ts` (root)
            // sudah melakukan refresh session di setiap request.
          }
        },
      },
    },
  );
}
