import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_DEFINITIONS, STATUS_LABELS } from "@/lib/constants/stages";
import { DaysInStage } from "@/components/documents/days-in-stage";
import type { DocumentStatus, Stage } from "@/lib/types/domain";

const BANNER_CLASSES: Record<DocumentStatus, string> = {
  in_progress: "border-status-progress/30 bg-status-progress/5",
  revision_requested: "border-status-revision/30 bg-status-revision/5",
  finalized: "border-status-finalized/30 bg-status-finalized/5",
  cancelled: "border-status-cancelled/30 bg-status-cancelled/5",
};

const DOT_CLASSES: Record<DocumentStatus, string> = {
  in_progress: "bg-status-progress",
  revision_requested: "bg-status-revision",
  finalized: "bg-status-finalized",
  cancelled: "bg-status-cancelled",
};

const LABEL_CLASSES: Record<DocumentStatus, string> = {
  in_progress: "text-status-progress",
  revision_requested: "text-status-revision",
  finalized: "text-status-finalized",
  cancelled: "text-status-cancelled",
};

/**
 * Banner status di panel kanan detail dokumen — pengganti pasangan badge
 * kecil, versi lebih deskriptif dari DESIGN_BRIEF mockup terbaru (dot
 * berdenyut untuk status aktif, ringkasan stage + hari di stage dalam satu
 * kotak berwarna sesuai status).
 */
export function StatusBanner({
  status,
  stage,
  daysInStage,
}: {
  status: DocumentStatus;
  stage: Stage;
  daysInStage: number;
}) {
  const isPulsing = status === "in_progress";

  return (
    <div className={cn("rounded-lg border p-4", BANNER_CLASSES[status])}>
      <div className="mb-1 flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            DOT_CLASSES[status],
            isPulsing && "animate-pulse",
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "text-[11px] font-semibold tracking-wide uppercase",
            LABEL_CLASSES[status],
          )}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
      <div className="text-[15px] font-semibold text-foreground">
        Stage {stage} · {STAGE_DEFINITIONS[stage].name}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="size-3.5" aria-hidden="true" />
        <DaysInStage days={daysInStage} /> di stage ini
      </div>
    </div>
  );
}
