"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCombobox, type SelectableUser } from "@/components/documents/user-combobox";
import { addTeamMember, removeTeamMember } from "@/lib/actions/team";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { Role } from "@/lib/types/domain";

// dalmut lewat ROLE_LABELS (bukan hardcode "(Dalmut)") — sudah punya
// parenthetical sendiri ("Irban (Pengendali Mutu)"), dobel kurung kalau
// ditambah lagi.
const ROLE_SECTIONS: { role: Role; label: string }[] = [
  { role: "dalnis", label: "Pengendali Teknis (Dalnis)" },
  { role: "dalmut", label: ROLE_LABELS.dalmut },
  { role: "operator", label: "Operator" },
];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function TeamManager({
  members,
  available,
}: {
  members: readonly SelectableUser[];
  available: readonly SelectableUser[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAdd(userId: string) {
    startTransition(async () => {
      const result = await addTeamMember(userId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Anggota ditambahkan ke tim.");
      router.refresh();
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      const result = await removeTeamMember(userId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Anggota dikeluarkan dari tim.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      {ROLE_SECTIONS.map(({ role, label }) => {
        const roleMembers = members.filter((m) => m.roles.includes(role));
        const roleAvailable = available.filter((a) => a.roles.includes(role));
        return (
          <Card key={role}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {roleMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada anggota.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {roleMembers.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                            {initials(m.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm">{m.name}</span>
                          <span className="truncate text-xs text-text-muted">{m.email}</span>
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() => handleRemove(m.id)}
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
                users={roleAvailable}
                value={undefined}
                onChange={handleAdd}
                placeholder={roleAvailable.length === 0 ? "Tidak ada kandidat tersedia" : "Tambah anggota..."}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
