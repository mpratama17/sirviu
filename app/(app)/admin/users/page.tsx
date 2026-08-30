import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { AddUserModal } from "@/components/admin/add-user-modal";
import { UsersTable } from "@/components/admin/users-table";
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
    .select("id, name, email, roles, is_active, created_at")
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Manajemen Pengguna
          </h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} pengguna terdaftar · {activeCount} aktif
          </p>
        </div>
        <AddUserModal />
      </div>
      <UsersTable users={rows} activeSort={activeSort} />
    </div>
  );
}
