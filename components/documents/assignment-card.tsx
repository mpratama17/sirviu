import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { Role } from "@/lib/types/domain";

export interface AssignedUser {
  role: Role;
  name: string;
  email: string;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** 4 avatar + nama + role — DESIGN_BRIEF §5.5.A. */
export function AssignmentCard({ team }: { team: readonly AssignedUser[] }) {
  return (
    <div className="flex flex-col gap-3">
      {team.map((member) => (
        <div key={member.role} className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {initials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {member.name}
            </p>
            <p className="text-xs text-text-muted">{ROLE_LABELS[member.role]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
