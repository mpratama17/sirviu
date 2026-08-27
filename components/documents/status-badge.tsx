import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants/stages";
import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/lib/types/domain";

const STATUS_CLASSES: Record<DocumentStatus, string> = {
  in_progress: "bg-status-progress/10 text-status-progress",
  revision_requested: "bg-status-revision/10 text-status-revision",
  finalized: "bg-status-finalized/10 text-status-finalized",
  cancelled: "bg-status-cancelled/10 text-status-cancelled",
};

/** Badge status dokumen — warna signaling, bukan dekorasi (DESIGN_BRIEF §4.2). */
export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
