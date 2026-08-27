/**
 * Helper untuk ambil profil user yang sedang login, dipakai di Server
 * Components (layout, header, sidebar). Menggabungkan JWT claims (auth)
 * dengan row `public.users` (profil + roles).
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

export type CurrentUser = Database["public"]["Tables"]["users"]["Row"];

/**
 * Return `null` bila belum authenticated atau row profil belum ter-sync
 * (semestinya tidak terjadi — trigger `handle_new_user` jalan saat signup).
 * `proxy.ts` sudah menjamin route di `(app)` hanya diakses saat
 * authenticated, tapi fungsi ini tetap defensif untuk dipakai di mana saja.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", claimsData.claims.sub)
    .single();

  return profile;
}
