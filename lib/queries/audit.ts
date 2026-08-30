/**
 * Query builder audit trail — dipakai bareng oleh halaman admin/audit dan
 * route export CSV, supaya filter yang di-export selalu konsisten dengan
 * yang sedang dilihat di halaman.
 *
 * Sengaja dipecah jadi dua fungsi (resolve async terpisah dari build
 * sync) — bukan satu `async function` yang `return query.order(...)`.
 * Postgrest query builder itu "thenable" (punya `.then()`), dan kalau
 * di-return dari `async function`, runtime JS otomatis meng-await-nya
 * sebelum resolve — caller dapat response yang sudah final, BUKAN
 * builder yang masih bisa di-`.range()`. `buildAuditQuery` harus tetap
 * fungsi sync supaya builder-nya utuh sampai caller yang men-chain akhir.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export interface AuditFilters {
  q: string;
  action: string;
  actorId: string;
  from: string;
  to: string;
}

type SearchParamValue = string | string[] | undefined;

export function parseAuditFilters(
  params: Record<string, SearchParamValue>,
): AuditFilters {
  const asString = (v: SearchParamValue) => (typeof v === "string" ? v : "");
  return {
    q: asString(params.q).replace(/[,()]/g, " ").trim(),
    action: asString(params.action),
    actorId: asString(params.actor),
    from: asString(params.from),
    to: asString(params.to),
  };
}

/**
 * Cari id dokumen yang cocok `q` (nomor surat/nama laporan). `null` kalau
 * tidak ada pencarian teks aktif (beda dari `[]` yang berarti "cari tapi
 * tidak ada yang cocok").
 */
export async function resolveDocumentIdsForSearch(
  supabase: SupabaseClient<Database>,
  q: string,
): Promise<string[] | null> {
  if (!q) return null;
  const { data } = await supabase
    .from("documents")
    .select("id")
    .or(`nomor_surat_tugas.ilike.%${q}%,nama_laporan.ilike.%${q}%`);
  return (data ?? []).map((d) => d.id);
}

/** Sync — lihat catatan di atas kenapa ini tidak boleh jadi async function. */
export function buildAuditQuery(
  supabase: SupabaseClient<Database>,
  filters: AuditFilters,
  documentIds: string[] | null,
  sort: { column: "created_at" | "action"; direction: "asc" | "desc" } = {
    column: "created_at",
    direction: "desc",
  },
) {
  let query = supabase.from("stage_transitions").select("*", { count: "exact" });

  if (documentIds !== null) {
    query =
      documentIds.length > 0
        ? query.in("document_id", documentIds)
        : query.eq("document_id", "00000000-0000-0000-0000-000000000000");
  }
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.actorId) query = query.eq("actor_id", filters.actorId);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59`);

  return query.order(sort.column, { ascending: sort.direction === "asc" });
}
