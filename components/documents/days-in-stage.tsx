import { cn } from "@/lib/utils";

/** Angka + color coding: <3 hari hijau, 3-7 hari kuning, >7 hari merah (DESIGN_BRIEF §4.2). */
export function DaysInStage({ days }: { days: number }) {
  const colorClass =
    days < 3
      ? "text-status-approved"
      : days <= 7
        ? "text-status-progress"
        : "text-status-revision";

  return (
    <span className={cn("tabular-nums font-medium", colorClass)}>
      {days} hari
    </span>
  );
}
