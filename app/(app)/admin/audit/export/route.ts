import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import {
  buildAuditQuery,
  parseAuditFilters,
  resolveDocumentIdsForSearch,
} from "@/lib/queries/audit";
import { roleForTransition } from "@/lib/constants/audit";
import { ACTION_LABELS } from "@/lib/constants/stages";
import { ROLE_LABELS } from "@/lib/constants/roles";

const MAX_EXPORT_ROWS = 10000;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: readonly string[]): string {
  return fields.map(csvEscape).join(",") + "\r\n";
}

/**
 * Export audit trail ke CSV (brief §9, ditandai "bonus"). Pakai filter
 * URL yang sama dengan halaman admin/audit (lib/queries/audit.ts) supaya
 * hasil export selalu konsisten dengan yang sedang dilihat admin.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("admin")) {
    return NextResponse.json({ error: "Hanya admin yang boleh export." }, { status: 403 });
  }

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const filters = parseAuditFilters(params);

  const supabase = await createClient();
  const searchDocumentIds = await resolveDocumentIdsForSearch(supabase, filters.q);
  const { data: transitions, error } = await buildAuditQuery(
    supabase,
    filters,
    searchDocumentIds,
  ).range(0, MAX_EXPORT_ROWS - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  let csv = toCsvRow([
    "Timestamp",
    "Nomor Surat Tugas",
    "Actor",
    "Peran",
    "Aksi",
    "From Stage",
    "To Stage",
    "Komentar",
    "Superseded",
  ]);

  for (const t of transitions ?? []) {
    const role = roleForTransition(t.from_stage);
    csv += toCsvRow([
      new Date(t.created_at).toISOString(),
      docMap.get(t.document_id) ?? "",
      actorMap.get(t.actor_id) ?? "",
      role ? ROLE_LABELS[role] : "",
      ACTION_LABELS[t.action] ?? t.action,
      t.from_stage === null ? "" : String(t.from_stage),
      String(t.to_stage),
      t.comment ?? "",
      t.is_superseded ? "ya" : "tidak",
    ]);
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-trail-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
