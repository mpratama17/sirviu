import Link from "next/link";
import { FolderOpen, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import {
  getUserRoleOnDocument,
  isAssignedToCurrentStage,
} from "@/lib/utils/permissions";
import { daysSince } from "@/lib/utils/dates";
import { DocumentFilters } from "@/components/documents/document-filters";
import {
  DocumentTable,
  type DocumentRow,
} from "@/components/documents/document-table";
import { DocumentPagination } from "@/components/documents/pagination";
import { EmptyState } from "@/components/documents/empty-state";
import { KpiCards, type DashboardKpis } from "@/components/documents/kpi-cards";
import { parseSortParams } from "@/lib/utils/sort";
import type { DocumentStatus, Role, Stage } from "@/lib/types/domain";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Kartu ringkasan di atas dashboard — dihitung dari fetch RINGAN terpisah
 * (cuma kolom yang dibutuhkan permission logic), lepas dari filter/paginasi
 * tabel di bawahnya (KPI selalu menggambarkan "dunia saya" secara utuh, mockup
 * baru). Pakai visibility rule YANG SAMA dengan query utama (admin lihat
 * semua, selain itu involvement filter) — jangan sampai KPI dan tabel
 * berbeda cakupan.
 */
async function getDashboardKpis(
  supabase: Supabase,
  userId: string,
  isAdmin: boolean,
): Promise<DashboardKpis> {
  let kpiQuery = supabase
    .from("documents")
    .select(
      "id, current_stage, status, ketua_tim_id, dalnis_id, dalmut_id, operator_id, current_stage_started_at",
    );

  if (!isAdmin) {
    kpiQuery = kpiQuery.or(
      `submitter_id.eq.${userId},ketua_tim_id.eq.${userId},dalnis_id.eq.${userId},dalmut_id.eq.${userId},operator_id.eq.${userId}`,
    );
  }

  const { data } = await kpiQuery;
  const rows = data ?? [];

  let needsMyAction = 0;
  let underReview = 0;
  let aging = 0;

  for (const doc of rows) {
    const minimal = {
      id: doc.id,
      submitterId: "",
      ketuaTimId: doc.ketua_tim_id,
      dalnisId: doc.dalnis_id,
      dalmutId: doc.dalmut_id,
      operatorId: doc.operator_id,
      currentStage: doc.current_stage as Stage,
      status: doc.status as DocumentStatus,
    };

    if (
      doc.status === "in_progress" &&
      isAssignedToCurrentStage(minimal, userId)
    ) {
      needsMyAction++;
    }
    if ([2, 3, 4].includes(doc.current_stage)) {
      underReview++;
    }
    if (
      doc.status !== "finalized" &&
      doc.status !== "cancelled" &&
      daysSince(doc.current_stage_started_at) > 7
    ) {
      aging++;
    }
  }

  return { total: rows.length, needsMyAction, underReview, aging };
}

const PAGE_SIZE = 20;

const ROLE_COLUMN: Record<Role, string> = {
  ketua_tim: "ketua_tim_id",
  dalnis: "dalnis_id",
  dalmut: "dalmut_id",
  operator: "operator_id",
  admin: "id", // tidak dipakai — admin bukan opsi filter peran
};

function parseStages(param: string | undefined): Stage[] {
  if (!param) return [];
  return param
    .split(",")
    .map(Number)
    .filter((n): n is Stage => n >= 1 && n <= 5);
}

/** Buang karakter yang punya arti khusus di syntax filter PostgREST (`,`, `(`, `)`). */
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()]/g, " ").trim();
}

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null; // ditangani AppLayout

  const q = typeof params.q === "string" ? sanitizeSearchTerm(params.q) : "";
  const stages = parseStages(
    typeof params.stage === "string" ? params.stage : undefined,
  );
  const status =
    typeof params.status === "string" ? (params.status as DocumentStatus) : "";
  const peran = typeof params.peran === "string" ? (params.peran as Role) : "";
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const page = Math.max(1, Number(params.page) || 1);
  const scope = typeof params.scope === "string" ? params.scope : "";

  const SORT_ALLOWED = [
    "created_at",
    "nomor_surat_tugas",
    "nama_laporan",
    "current_stage",
    "days_in_stage",
  ] as const;
  const activeSort = parseSortParams(params, SORT_ALLOWED, {
    column: "created_at",
    direction: "desc",
  });
  // `days_in_stage` bukan kolom asli — hari di stage naik saat
  // current_stage_started_at makin lama, jadi arah SQL-nya kebalik.
  const orderColumn =
    activeSort.column === "days_in_stage"
      ? "current_stage_started_at"
      : activeSort.column;
  const ascending =
    activeSort.column === "days_in_stage"
      ? activeSort.direction === "desc"
      : activeSort.direction === "asc";

  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const supabase = await createClient();
  let query = supabase.from("documents").select("*", { count: "exact" });

  const isAdmin = user.roles.includes("admin");
  // Sidebar "Dokumen Saya" mengirim `?scope=mine` — artinya filter
  // involvement selalu diterapkan, bahkan untuk admin ("dokumen yang SAYA
  // terlibat", bukan "semua yang boleh saya lihat"). Tanpa scope=mine,
  // perilaku admin apa adanya (lihat semua) dipertahankan.
  const scopeMine = scope === "mine";

  if (peran && peran in ROLE_COLUMN) {
    // Filter "Peran Saya" tetap berlaku eksplisit walau admin — mereka
    // mungkin memang mau lihat "cuma yang saya jadi Dalnis", misalnya.
    query = query.eq(ROLE_COLUMN[peran], user.id);
  } else if (!isAdmin || scopeMine) {
    // Involvement filter untuk non-admin, ATAU untuk admin yang membuka
    // Dokumen Saya. Admin di dashboard default lihat semua (brief §6.5).
    query = query.or(
      `submitter_id.eq.${user.id},ketua_tim_id.eq.${user.id},dalnis_id.eq.${user.id},dalmut_id.eq.${user.id},operator_id.eq.${user.id}`,
    );
  }

  if (stages.length > 0) query = query.in("current_stage", stages);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  if (q)
    query = query.or(
      `nomor_surat_tugas.ilike.%${q}%,nama_laporan.ilike.%${q}%`,
    );

  const [{ data, count, error }, kpis] = await Promise.all([
    query.order(orderColumn, { ascending }).range(rangeFrom, rangeTo),
    getDashboardKpis(supabase, user.id, isAdmin),
  ]);

  if (error) {
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-6 text-sm text-destructive">
          Gagal memuat dokumen: {error.message}
        </p>
      </div>
    );
  }

  // Kolom "Tim" cuma untuk admin — peran lain sudah pasti lihat timnya
  // sendiri saja (RLS + involvement filter), jadi kolomnya mubazir di sana.
  // Lookup terpisah `id -> name` seperti di /admin/audit; repo ini tidak
  // memakai embed PostgREST di manapun.
  const teamNames = new Map<string, string>();
  if (isAdmin && data && data.length > 0) {
    const ketuaTimIds = [...new Set(data.map((doc) => doc.ketua_tim_id))];
    const { data: ketuaTims } = await supabase
      .from("users")
      .select("id, name")
      .in("id", ketuaTimIds);
    for (const kt of ketuaTims ?? []) teamNames.set(kt.id, kt.name);
  }

  const rows: DocumentRow[] = (data ?? []).map((doc) => ({
    id: doc.id,
    nomorSuratTugas: doc.nomor_surat_tugas,
    namaLaporan: doc.nama_laporan,
    currentStage: doc.current_stage as Stage,
    status: doc.status as DocumentStatus,
    daysInStage: daysSince(doc.current_stage_started_at),
    createdAt: doc.created_at,
    myRole: getUserRoleOnDocument(
      {
        id: doc.id,
        submitterId: doc.submitter_id,
        ketuaTimId: doc.ketua_tim_id,
        dalnisId: doc.dalnis_id,
        dalmutId: doc.dalmut_id,
        operatorId: doc.operator_id,
        currentStage: doc.current_stage as Stage,
        status: doc.status as DocumentStatus,
      },
      user.id,
    ),
    teamName: teamNames.get(doc.ketua_tim_id),
  }));

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = !!(q || stages.length || status || peran || from || to);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {scopeMine ? "Dokumen Saya" : "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} dokumen{hasFilters ? " (terfilter)" : ""}
          </p>
        </div>
        {user.roles.includes("ketua_tim") ? (
          <Button
            render={<Link href="/documents/new" />}
            nativeButton={false}
            className="shrink-0"
          >
            + Upload Dokumen Baru
          </Button>
        ) : null}
      </div>

      <KpiCards kpis={kpis} />

      <DocumentFilters />

      {rows.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="Tidak ada dokumen yang cocok dengan filter Anda."
          />
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="Belum ada dokumen. Dokumen yang Anda submit atau di mana Anda ditunjuk sebagai reviewer akan muncul di sini."
            action={
              user.roles.includes("ketua_tim")
                ? { label: "Upload Dokumen Baru", href: "/documents/new" }
                : undefined
            }
          />
        )
      ) : (
        <>
          <DocumentTable rows={rows} activeSort={activeSort} showTeam={isAdmin} />
          <DocumentPagination page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
