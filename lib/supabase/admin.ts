/**
 * Supabase client dengan service role key — BYPASS RLS sepenuhnya, dan
 * tidak punya identitas user (`auth.uid()` NULL di sisi Postgres).
 *
 * HANYA dipakai untuk operasi yang genuinely admin-only, di mana tidak ada
 * "actor" user biasa yang relevan — mis. admin user management (ubah
 * roles/is_active user lain), atau bootstrap.
 *
 * JANGAN dipakai untuk mutasi state machine dokumen (submit/approve/
 * reject/finalize/upload_revision) — itu butuh `actor_id` yang bisa
 * dipercaya (audit trail) dan permission check berbasis siapa yang login.
 * Pola yang benar untuk itu: `security definer` Postgres function yang
 * dipanggil lewat `lib/supabase/server.ts` (client session user), yang
 * derive actor dari `auth.uid()` di dalam function itu sendiri — bukan
 * dari parameter yang bisa dipalsukan caller. Lihat `lib/actions/documents.ts`.
 *
 * Jangan pernah import file ini dari kode yang bisa jalan di client.
 * Tidak pakai cookies — service role tidak terikat session user, jadi
 * pakai `@supabase/supabase-js` langsung, bukan `@supabase/ssr`.
 */
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
