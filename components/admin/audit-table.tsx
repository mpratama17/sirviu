import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ACTION_LABELS } from "@/lib/constants/stages";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types/domain";

/** Warna badge per jenis aksi — DESIGN_BRIEF mockup terbaru, biar aksi beda jenis kelihatan sekilas tanpa baca teks. */
const ACTION_CLASSES: Record<string, string> = {
  approve: "border-transparent bg-status-approved/10 text-status-approved",
  reject: "border-transparent bg-status-revision/10 text-status-revision",
  submit: "border-transparent bg-primary/10 text-primary",
  upload_revision: "border-transparent bg-status-progress/10 text-status-progress",
  finalize: "border-transparent bg-status-finalized/10 text-status-finalized",
  format_fix: "border-transparent bg-violet-500/10 text-violet-700",
  cancel: "border-transparent bg-status-cancelled/10 text-status-cancelled",
};

export interface AuditRow {
  id: string;
  createdAt: string;
  documentId: string;
  nomorSuratTugas: string;
  actorName: string;
  actorRole: Role | null;
  action: string;
  fromStage: number | null;
  toStage: number;
  comment: string | null;
  isSuperseded: boolean;
  /** true kalau actor bertindak sebagai admin di luar assignment aslinya — lihat migration ...000007. */
  isAdminOverride: boolean;
}

export function AuditTable({ rows }: { rows: readonly AuditRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Dokumen</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Aksi</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Komentar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={row.isSuperseded ? "opacity-60" : undefined}>
              <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                {new Date(row.createdAt).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell>
                <Link
                  href={`/documents/${row.documentId}`}
                  className="tabular-nums hover:underline"
                >
                  {row.nomorSuratTugas}
                </Link>
              </TableCell>
              <TableCell>
                <span className="text-foreground">{row.actorName}</span>
                {row.actorRole ? (
                  <span className="text-xs text-text-muted"> · {ROLE_LABELS[row.actorRole]}</span>
                ) : null}
                {row.isAdminOverride ? (
                  <Badge
                    variant="outline"
                    className="ml-1.5 border-status-revision/40 text-status-revision"
                    title="Admin bertindak di luar assignment aslinya di dokumen ini"
                  >
                    Admin Override
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn("font-medium", ACTION_CLASSES[row.action])}
                >
                  {ACTION_LABELS[row.action] ?? row.action}
                </Badge>
                {row.isSuperseded ? (
                  <span className="ml-1.5 text-xs text-text-muted">(superseded)</span>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                {row.fromStage ?? "—"} → {row.toStage}
              </TableCell>
              <TableCell className="max-w-64 truncate text-muted-foreground" title={row.comment ?? ""}>
                {row.comment ?? "—"}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada aktivitas yang cocok dengan filter.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
