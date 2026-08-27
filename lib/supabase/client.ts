/**
 * Supabase client untuk Client Components (browser).
 * Selalu buat instance baru per komponen yang butuh — jangan singleton
 * module-level manual, `createBrowserClient` sudah menangani reuse secara
 * internal (`isSingleton`, default true).
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
