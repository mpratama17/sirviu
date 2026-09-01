import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { TeamManager } from "@/components/team/team-manager";
import type { SelectableUser } from "@/components/documents/user-combobox";
import { ROLE_LABELS } from "@/lib/constants/roles";

/**
 * Anggota tim (Ketua Tim ↔ dalnis/dalmut/operator) — masukan user setelah
 * testing, lihat AGENTS.md. Self-service: cuma ketua_tim yang bisa buka
 * halaman ini dan cuma untuk timnya sendiri (ditegakkan lagi di RPC
 * assign_team_member/remove_team_member, halaman ini cuma UI).
 */
export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("ketua_tim")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, roles, is_active, team_ketua_tim_id")
    .order("name");

  const toSelectable = (u: NonNullable<typeof users>[number]): SelectableUser => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    isActive: u.is_active,
  });

  const rows = users ?? [];
  const members = rows.filter((u) => u.team_ketua_tim_id === user.id).map(toSelectable);
  const available = rows
    .filter(
      (u) =>
        u.is_active &&
        u.team_ketua_tim_id === null &&
        !u.roles.includes("ketua_tim") &&
        !u.roles.includes("admin") &&
        u.roles.some((r) => ["dalnis", "dalmut", "operator"].includes(r)),
    )
    .map(toSelectable);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Tim Saya
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Anggota di sini yang muncul sebagai pilihan {ROLE_LABELS.dalnis},{" "}
        {ROLE_LABELS.dalmut}, dan {ROLE_LABELS.operator} saat upload dokumen baru.
      </p>
      <TeamManager members={members} available={available} />
    </div>
  );
}
