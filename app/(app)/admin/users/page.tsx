import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { AddUserModal } from "@/components/admin/add-user-modal";
import { UsersTable } from "@/components/admin/users-table";
import { AdminTeamsPanel, type AdminTeam } from "@/components/admin/admin-teams-panel";
import type { SelectableUser } from "@/components/documents/user-combobox";
import type { EditableUser } from "@/components/admin/edit-user-modal";
import { parseSortParams } from "@/lib/utils/sort";
import type { Role } from "@/lib/types/domain";

const USERS_SORT_ALLOWED = ["name", "email", "created_at"] as const;

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("admin")) {
    redirect("/dashboard");
  }

  const activeSort = parseSortParams(params, USERS_SORT_ALLOWED, {
    column: "name",
    direction: "asc",
  });

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, roles, is_active, created_at, team_ketua_tim_id")
    .order(activeSort.column, { ascending: activeSort.direction === "asc" });

  const rows: EditableUser[] = (users ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles as Role[],
    isActive: u.is_active,
    createdAt: u.created_at,
  }));

  const activeCount = rows.filter((u) => u.isActive).length;

  // Daftar tim = daftar user ber-role ketua_tim (termasuk yang rosternya
  // masih kosong — justru itu yang perlu kelihatan admin), diurut nama biar
  // stabil apapun sort tabel di bawahnya.
  const allUsers = users ?? [];
  const toSelectable = (u: (typeof allUsers)[number]): SelectableUser => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    isActive: u.is_active,
  });
  const byName = (a: SelectableUser, b: SelectableUser) => a.name.localeCompare(b.name);

  const teams: AdminTeam[] = allUsers
    .filter((u) => u.roles.includes("ketua_tim"))
    .map(toSelectable)
    .sort(byName)
    .map((ketuaTim) => ({
      ketuaTim,
      members: allUsers
        .filter((u) => u.team_ketua_tim_id === ketuaTim.id)
        .map(toSelectable)
        .sort(byName),
    }));

  const unassigned = allUsers
    .filter(
      (u) =>
        u.is_active &&
        u.team_ketua_tim_id === null &&
        !u.roles.includes("ketua_tim") &&
        !u.roles.includes("admin") &&
        u.roles.some((r) => ["dalnis", "dalmut", "operator"].includes(r)),
    )
    .map(toSelectable)
    .sort(byName);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Manajemen Pengguna
          </h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} pengguna terdaftar · {activeCount} aktif · {teams.length} tim
          </p>
        </div>
        <AddUserModal />
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Tim &amp; Anggota
          </h2>
          <p className="text-sm text-muted-foreground">
            Anggota tim menentukan siapa yang bisa dipilih Ketua Tim sebagai
            Pengendali Teknis, Pengendali Mutu, dan Operator saat upload dokumen.
          </p>
        </div>
        <AdminTeamsPanel teams={teams} unassigned={unassigned} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Semua Pengguna
        </h2>
        <UsersTable users={rows} activeSort={activeSort} />
      </section>
    </div>
  );
}
