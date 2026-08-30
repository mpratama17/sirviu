import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/session";
import { RoleSelectForm } from "@/components/auth/role-select-form";

/**
 * Onboarding pertama kali user login (Google atau email/password) belum
 * punya role apapun (roles = []). Layout `(app)/layout.tsx` melempar user
 * ke sini bila roles kosong; setelah role dipilih, layout tidak akan
 * melempar lagi (roles.length > 0 → langsung dashboard).
 *
 * Kalau user yang sudah punya role sengaja buka URL ini, tendang balik ke
 * dashboard — RPC-nya sendiri juga akan menolak (guard "roles harus
 * kosong"), tapi lebih baik tidak render halaman irrelevan.
 */
export default async function OnboardingRolePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.roles.length > 0) redirect("/dashboard");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Pilih Peran Anda
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Pilih satu peran yang paling sesuai dengan tugas Anda. Peran ini
        menentukan halaman dan aksi yang tersedia bagi Anda di SIRVIU.
      </p>
      <RoleSelectForm />
    </div>
  );
}
