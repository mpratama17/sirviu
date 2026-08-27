/**
 * Supabase client dengan service role key — BYPASS RLS sepenuhnya.
 *
 * HANYA dipakai di server actions untuk mutasi yang secara sengaja tidak
 * boleh lewat RLS biasa (mis. update `documents.current_stage`/`status`,
 * insert `document_versions`/`stage_transitions`, admin user management).
 * Jangan pernah import file ini dari kode yang bisa jalan di client.
 *
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
