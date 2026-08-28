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
import type { Role } from "@/lib/types/domain";

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
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
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
