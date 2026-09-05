import Link from "next/link";
import { Download, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StageBadge } from "@/components/documents/stage-badge";
import { StatusBadge } from "@/components/documents/status-badge";
import { DaysInStage } from "@/components/documents/days-in-stage";
import { DocumentCardList } from "@/components/documents/document-card-list";
import { SortableHeader } from "@/components/ui/sortable-header";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { SortState } from "@/lib/utils/sort";
import type { DocumentStatus, Role, Stage } from "@/lib/types/domain";

export interface DocumentRow {
  id: string;
  nomorSuratTugas: string;
  namaLaporan: string;
  currentStage: Stage;
  status: DocumentStatus;
  daysInStage: number;
  createdAt: string;
  myRole: Role | null;
  /** Nama Ketua Tim pemilik dokumen — hanya diisi untuk admin (lihat dashboard). */
  teamName?: string;
}

export function DocumentTable({
  rows,
  activeSort,
  showTeam = false,
}: {
  rows: readonly DocumentRow[];
  activeSort: SortState;
  /** Kolom "Tim" cuma relevan buat admin: peran lain selalu lihat timnya sendiri. */
  showTeam?: boolean;
}) {
  return (
    <>
      <DocumentCardList rows={rows} showTeam={showTeam} />
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader column="nomor_surat_tugas" label="Nomor Surat Tugas" activeSort={activeSort} />
            </TableHead>
            <TableHead>
              <SortableHeader column="nama_laporan" label="Nama Laporan" activeSort={activeSort} />
            </TableHead>
            {/* Bukan kolom DB (nama Ketua Tim ada di tabel users), jadi
                sengaja TIDAK sortable — `order=tim` akan ditolak PostgREST. */}
            {showTeam ? <TableHead>Tim</TableHead> : null}
            <TableHead>
              <SortableHeader column="current_stage" label="Stage Saat Ini" activeSort={activeSort} />
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <SortableHeader column="days_in_stage" label="Hari di Stage" activeSort={activeSort} />
            </TableHead>
            <TableHead>Peran Saya</TableHead>
            <TableHead>
              <SortableHeader column="created_at" label="Tanggal Upload" activeSort={activeSort} />
            </TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="group">
              <TableCell className="tabular-nums">
                <Link href={`/documents/${row.id}`} className="hover:underline">
                  {row.nomorSuratTugas}
                </Link>
              </TableCell>
              <TableCell className="max-w-64" title={row.namaLaporan}>
                <Link href={`/documents/${row.id}`} className="block truncate hover:underline">
                  {row.namaLaporan}
                </Link>
              </TableCell>
              {showTeam ? (
                <TableCell className="max-w-40 truncate" title={row.teamName}>
                  {row.teamName ?? "-"}
                </TableCell>
              ) : null}
              <TableCell>
                <StageBadge stage={row.currentStage} />
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell>
                <DaysInStage days={row.daysInStage} />
              </TableCell>
              <TableCell>
                {row.myRole ? ROLE_LABELS[row.myRole] : "-"}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {new Date(row.createdAt).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Link
                          href={`/documents/${row.id}`}
                          aria-label="Lihat detail"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        />
                      }
                    >
                      <Eye className="size-4" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>Lihat detail</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <a
                          href={`/documents/${row.id}/download`}
                          aria-label="Download versi terbaru"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        />
                      }
                    >
                      <Download className="size-4" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>Download versi terbaru</TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </>
  );
}
