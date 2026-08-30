/**
 * Helper untuk sort-by-header di tabel-tabel data (Dashboard, Manajemen
 * Pengguna, Audit Trail). State disimpan di URL query params (`?sort=col&
 * dir=asc|desc`) — shareable, refresh-safe, konsisten dengan filter yang
 * sudah pakai URL.
 *
 * Pola pemakaian:
 *   const { column, direction } = parseSortParams(searchParams, ALLOWED, DEFAULT);
 *   query.order(column, { ascending: direction === "asc" });
 *
 * Whitelist WAJIB — jangan pernah passthrough kolom mentah dari URL ke
 * `.order()`; itu SQL-injection risk (dengan cara yang lucu: PostgREST akan
 * meng-quote nama kolom, tapi kolom yang tidak ada akan return error 400
 * ke user dan bisa dipakai untuk enum kolom).
 */
export type SortDirection = "asc" | "desc";

export interface SortState<C extends string = string> {
  column: C;
  direction: SortDirection;
}

export function parseSortParams<C extends string>(
  params: Record<string, string | string[] | undefined>,
  allowed: readonly C[],
  defaultSort: SortState<C>,
): SortState<C> {
  const rawSort = typeof params.sort === "string" ? params.sort : "";
  const rawDir = typeof params.dir === "string" ? params.dir : "";
  const column = (allowed as readonly string[]).includes(rawSort)
    ? (rawSort as C)
    : defaultSort.column;
  const direction: SortDirection = rawDir === "asc" || rawDir === "desc"
    ? rawDir
    : defaultSort.direction;
  return { column, direction };
}

/**
 * Bangun href untuk `<Link>` di `SortableHeader`. Toggle behavior:
 * - Kolom berbeda dari yang aktif → set kolom baru + `dir=asc` (default).
 * - Kolom sama, arah `asc` → ubah ke `desc`.
 * - Kolom sama, arah `desc` → hapus sort (kembali ke default page).
 *
 * Query params lain (filter, page, dst) dipertahankan.
 */
export function buildSortHref(
  pathname: string,
  currentParams: URLSearchParams,
  targetColumn: string,
  activeSort: SortState,
): string {
  const params = new URLSearchParams(currentParams.toString());
  params.delete("page"); // sort selalu reset ke halaman 1

  if (activeSort.column === targetColumn) {
    if (activeSort.direction === "asc") {
      params.set("sort", targetColumn);
      params.set("dir", "desc");
    } else {
      params.delete("sort");
      params.delete("dir");
    }
  } else {
    params.set("sort", targetColumn);
    params.set("dir", "asc");
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
