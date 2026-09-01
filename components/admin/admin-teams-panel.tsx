"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCombobox, type SelectableUser } from "@/components/documents/user-combobox";
import { addTeamMember, removeTeamMember } from "@/lib/actions/team";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { Role } from "@/lib/types/domain";

export interface AdminTeam {
  ketuaTim: SelectableUser;
  members: readonly SelectableUser[];
}

const MEMBER_ROLES: Role[] = ["dalnis", "dalmut", "operator"];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function memberRoleLabel(user: SelectableUser): string {
  return MEMBER_ROLES.filter((r) => user.roles.includes(r))
    .map((r) => ROLE_LABELS[r])
    .join(" / ");
}

/**
 * Panel "berapa tim & siapa anggotanya" untuk admin (permintaan user).
 * Admin di sini super admin: bukan cuma lihat, tapi juga boleh menambah
 * dan mengeluarkan anggota tim SIAPAPUN — halaman /team milik Ketua Tim
 * tetap ada dan tetap self-service, ini jalur paralel.
 *
 * Tim di-derive dari `roles` (setiap user ber-role ketua_tim = satu tim),
 * BUKAN dari daftar team_ketua_tim_id yang terpakai — kalau tidak, Ketua
 * Tim yang rosternya masih kosong hilang dari daftar, padahal justru itu
 * yang perlu dilihat admin (KT tanpa anggota tidak bisa upload sama sekali).
 */
export function AdminTeamsPanel({
  teams,
  unassigned,
}: {
  teams: readonly AdminTeam[];
  unassigned: readonly SelectableUser[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  if (teams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada pengguna dengan peran Ketua Tim, jadi belum ada tim.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* `self-start`: tanpa ini kartu tim kosong ikut meregang setinggi
          kartu tetangganya di baris grid yang sama — ruang kosong menganga. */}
      <div className="grid items-start gap-3 md:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.ketuaTim.id} className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                      {initials(team.ketuaTim.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {team.ketuaTim.name}
                    </span>
                    <span className="truncate text-xs font-normal text-text-muted">
                      {team.ketuaTim.email}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {team.ketuaTim.isActive ? null : (
                    <Badge variant="outline">Nonaktif</Badge>
                  )}
                  <Badge variant="secondary">{team.members.length} anggota</Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {team.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada anggota — Ketua Tim ini belum bisa upload dokumen.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {team.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 truncate text-sm">
                          {m.name}
                          {m.isActive ? null : (
                            <Badge variant="outline">Nonaktif</Badge>
                          )}
                        </span>
                        <span className="truncate text-xs text-text-muted">
                          {memberRoleLabel(m)} · {m.email}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() =>
                          run(
                            () => removeTeamMember(m.id),
                            "Anggota dikeluarkan dari tim.",
                          )
                        }
                        title="Keluarkan dari tim"
                      >
                        {isPending ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <UserMinus className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <UserCombobox
                users={unassigned}
                value={undefined}
                onChange={(userId) =>
                  run(
                    () => addTeamMember(userId, team.ketuaTim.id),
                    "Anggota ditambahkan ke tim.",
                  )
                }
                placeholder={
                  unassigned.length === 0
                    ? "Semua Dalnis/Dalmut/Operator sudah punya tim"
                    : "Tambah anggota..."
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-text-muted">
        Satu orang hanya bisa berada di satu tim. Untuk memindahkan anggota,
        keluarkan dulu dari tim lamanya.
      </p>
    </div>
  );
}
