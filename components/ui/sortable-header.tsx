"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildSortHref, type SortState } from "@/lib/utils/sort";

/**
 * `useLinkStatus` cuma bisa dipakai di descendant `<Link>` (bukan di
 * `SortableHeader` sendiri) — lihat next/dist/docs/.../use-link-status.md.
 * Ganti panah sort jadi spinner selama navigasi (klik sort re-fetch
 * server component via searchParams, TIDAK trigger loading.tsx route
 * karena masih di segment yang sama).
 */
function SortIcon({ icon: Icon, isActive }: { icon: typeof ArrowUpDown; isActive: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />;
  }
  return (
    <Icon
      className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-text-muted opacity-70")}
      aria-hidden="true"
    />
  );
}

/**
 * Tombol column-header yang bisa di-klik untuk sort. Dipakai di dalam
 * `<TableHead>` — full-width `<Link>` yang toggle sort via URL.
 * Server component page-nya membaca URL dan mengurutkan datanya; komponen
 * ini murni presentational + link-builder.
 */
export function SortableHeader({
  column,
  label,
  activeSort,
  align = "left",
}: {
  /** Kolom (dari allowlist page-nya) yang di-sort oleh header ini. */
  column: string;
  label: string;
  /** State sort yang aktif sekarang, dari `parseSortParams()`. */
  activeSort: SortState;
  align?: "left" | "right";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = activeSort.column === column;
  const href = buildSortHref(pathname, searchParams, column, activeSort);

  const Icon = !isActive
    ? ArrowUpDown
    : activeSort.direction === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex select-none items-center gap-1 rounded-sm py-0.5 text-inherit transition-colors hover:text-foreground",
        align === "right" && "justify-end",
        isActive && "text-foreground",
      )}
    >
      {label}
      <SortIcon icon={Icon} isActive={isActive} />
    </Link>
  );
}
