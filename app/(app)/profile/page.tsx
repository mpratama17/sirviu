import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/profile/profile-form";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { Role } from "@/lib/types/domain";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const STAT_COLUMNS = [
  { role: "ketua_tim" as Role, column: "ketua_tim_id" },
  { role: "dalnis" as Role, column: "dalnis_id" },
  { role: "dalmut" as Role, column: "dalmut_id" },
  { role: "operator" as Role, column: "operator_id" },
];

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // 4 count-only query ringan (head:true, tanpa fetch baris) — jumlah
  // dokumen di mana user ini pemegang peran tsb, terlepas dari role yang
  // dia PUNYA (`user.roles`) — activity stats menghitung penugasan nyata.
  const stats = await Promise.all(
    STAT_COLUMNS.map(async ({ role, column }) => {
      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq(column, user.id);
      return { role, value: count ?? 0 };
    }),
  );

  const rolesList = (user.roles as Role[]).map((r) => ROLE_LABELS[r]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Profil</h1>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary text-xl text-primary-foreground">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold text-foreground">{user.name}</div>
            <div className="mt-0.5 text-sm text-muted-foreground">{user.email}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rolesList.length > 0 ? (
                rolesList.map((label) => (
                  <span
                    key={label}
                    className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                  >
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-xs text-text-muted">Belum ada role</span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Untuk mengubah role, hubungi Admin.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3.5 text-base font-semibold text-foreground">Informasi Akun</h2>
        <ProfileForm name={user.name} email={user.email} />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3.5 text-base font-semibold text-foreground">Aktivitas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.role} className="rounded-md border border-border p-3">
              <div className="text-[11px] font-medium text-muted-foreground">
                Sebagai {ROLE_LABELS[s.role]}
              </div>
              <div className="mt-1 text-[22px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
                {s.value}
              </div>
              <div className="mt-1 text-[11px] text-text-muted">dokumen</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Bergabung sejak{" "}
          <strong className="font-medium text-foreground">
            {new Date(user.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </strong>
        </p>
      </div>

      <form action={signOut}>
        <Button
          type="submit"
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Keluar
        </Button>
      </form>
    </div>
  );
}
