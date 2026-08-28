import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { AuditFilters } from "@/components/admin/audit-filters";
import { AuditTable, type AuditRow } from "@/components/admin/audit-table";
import { DocumentPagination } from "@/components/documents/pagination";
import {
  buildAuditQuery,
  parseAuditFilters,
  resolveDocumentIdsForSearch,
} from "@/lib/queries/audit";
import { roleForTransition } from "@/lib/constants/audit";
import type { SelectableUser } from "@/components/documents/user-combobox";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: PageProps<"/admin/audit">) {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("admin")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const filters = parseAuditFilters(params);
  const page = Math.max(1, Number(params.page) || 1);
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const supabase = await createClient();
  const searchDocumentIds = await resolveDocumentIdsForSearch(supabase, filters.q);

  const [{ data: transitions, count, error }, { data: allUsers }] = await Promise.all([
    buildAuditQuery(supabase, filters, searchDocumentIds).range(rangeFrom, rangeTo),
    supabase.from("users").select("id, name, email, roles, is_active").order("name"),
  ]);

  const documentIds = Array.from(new Set((transitions ?? []).map((t) => t.document_id)));
  const actorIds = Array.from(new Set((transitions ?? []).map((t) => t.actor_id)));

  const [{ data: docs }, { data: actors }] = await Promise.all([
    documentIds.length > 0
      ? supabase.from("documents").select("id, nomor_surat_tugas").in("id", documentIds)
      : Promise.resolve({ data: [] as { id: string; nomor_surat_tugas: string }[] }),
    actorIds.length > 0
      ? supabase.from("users").select("id, name").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const docMap = new Map((docs ?? []).map((d) => [d.id, d.nomor_surat_tugas]));
  const actorMap = new Map((actors ?? []).map((a) => [a.id, a.name]));

  const rows: AuditRow[] = (transitions ?? []).map((t) => ({
    id: t.id,
    createdAt: t.created_at,
    documentId: t.document_id,
    nomorSuratTugas: docMap.get(t.document_id) ?? "—",
    actorName: actorMap.get(t.actor_id) ?? "—",
    actorRole: roleForTransition(t.from_stage),
    action: t.action,
    fromStage: t.from_stage,
    toStage: t.to_stage,
    comment: t.comment,
    isSuperseded: t.is_superseded,
  }));

  const selectableUsers: SelectableUser[] = (allUsers ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    isActive: u.is_active,
  }));

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit Trail</h1>
        <p className="text-sm text-muted-foreground">{totalCount} aktivitas</p>
      </div>

      <AuditFilters users={selectableUsers} />

      {error ? (
        <p className="text-sm text-destructive">Gagal memuat audit trail: {error.message}</p>
      ) : (
        <>
          <AuditTable rows={rows} />
          <DocumentPagination page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
