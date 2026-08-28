import Link from "next/link";
import { Download } from "lucide-react";
import { StageBadge } from "@/components/documents/stage-badge";
import { StatusBadge } from "@/components/documents/status-badge";
import { DaysInStage } from "@/components/documents/days-in-stage";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { DocumentRow } from "@/components/documents/document-table";

/** Versi mobile dashboard table — DESIGN_BRIEF §7 (table -> card list di < md). */
export function DocumentCardList({ rows }: { rows: readonly DocumentRow[] }) {
  return (
    <div className="flex flex-col gap-3 sm:hidden">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={`/documents/${row.id}`}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium tabular-nums text-foreground">
                {row.nomorSuratTugas}
              </p>
              <p className="truncate text-sm text-muted-foreground">{row.namaLaporan}</p>
            </div>
            <a
              href={`/documents/${row.id}/download`}
              onClick={(e) => e.stopPropagation()}
              aria-label="Download versi terbaru"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Download className="size-4" aria-hidden="true" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={row.currentStage} />
            <StatusBadge status={row.status} />
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>
              {row.myRole ? ROLE_LABELS[row.myRole] : "-"} ·{" "}
              {new Date(row.createdAt).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <DaysInStage days={row.daysInStage} />
          </div>
        </Link>
      ))}
    </div>
  );
}
