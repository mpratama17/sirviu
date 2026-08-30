"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildSortHref, type SortState } from "@/lib/utils/sort";

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
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          isActive ? "text-primary" : "text-text-muted opacity-70",
        )}
        aria-hidden="true"
      />
    </Link>
  );
}
