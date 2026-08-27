"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Logout user saat ini dan redirect ke halaman login. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
