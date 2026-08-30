import type { LucideIcon } from "lucide-react";
import { FileText, AlertCircle, Loader2, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardKpis {
  total: number;
  needsMyAction: number;
  underReview: number;
  aging: number;
}

interface KpiDef {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
}

/** 4 kartu ringkasan di atas dashboard — DESIGN_BRIEF mockup terbaru. */
export function KpiCards({ kpis }: { kpis: DashboardKpis }) {
  const defs: KpiDef[] = [
    {
      label: "Total Dokumen",
      value: kpis.total,
      hint: "Semua status",
      icon: FileText,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    {
      label: "Perlu Aksi Anda",
      value: kpis.needsMyAction,
      hint: "Menunggu tanggapan",
      icon: AlertCircle,
      colorClass: "text-status-progress",
      bgClass: "bg-status-progress/10",
    },
    {
      label: "Sedang Direviu",
      value: kpis.underReview,
      hint: "Stage 2 · 4 · 6",
      icon: Loader2,
      colorClass: "text-status-progress",
      bgClass: "bg-status-progress/10",
    },
    {
      label: "Aging > 7 Hari",
      value: kpis.aging,
      hint: "Perlu perhatian",
      icon: Flame,
      colorClass: "text-status-revision",
      bgClass: "bg-status-revision/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {defs.map((k) => (
        <div
          key={k.label}
          className="rounded-lg border border-border bg-card px-4 py-3.5"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md",
                k.bgClass,
                k.colorClass,
              )}
            >
              <k.icon className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="text-[22px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
            {k.value}
          </div>
          <div className="mt-1 text-[11px] text-text-muted">{k.hint}</div>
        </div>
      ))}
    </div>
  );
}
