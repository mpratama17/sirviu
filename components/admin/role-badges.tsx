import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { Role } from "@/lib/types/domain";

export function RoleBadges({ roles }: { roles: readonly string[] }) {
  if (roles.length === 0) {
    return <span className="text-xs text-text-muted">Belum ada role</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} variant="secondary" className="font-normal">
          {ROLE_LABELS[role as Role] ?? role}
        </Badge>
      ))}
    </div>
  );
}
