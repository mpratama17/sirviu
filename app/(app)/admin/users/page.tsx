import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { AddUserModal } from "@/components/admin/add-user-modal";
import { UsersTable } from "@/components/admin/users-table";
import type { EditableUser } from "@/components/admin/edit-user-modal";
import type { Role } from "@/lib/types/domain";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("admin")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, roles, is_active")
    .order("name");

  const rows: EditableUser[] = (users ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles as Role[],
    isActive: u.is_active,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Manajemen Pengguna
        </h1>
        <AddUserModal />
      </div>
      <UsersTable users={rows} />
    </div>
  );
}
