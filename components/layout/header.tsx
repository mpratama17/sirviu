"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";

/**
 * Breadcrumb diturunkan dari NAV_ITEMS berdasarkan path aktif — cukup untuk
 * halaman-halaman top-level. Halaman detail (mis. /documents/[id]) bisa
 * override nanti kalau dibutuhkan breadcrumb bertingkat.
 *
 * Search & notifikasi masih placeholder (non-functional) — search dokumen
 * global dibangun di Milestone 2, notifikasi in-app masuk daftar Future
 * Enhancement (brief §10), badge sengaja dikosongkan sesuai DESIGN_BRIEF §5.2.
 */
export function Header() {
  const pathname = usePathname();
  const activeItem = NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  const breadcrumb = activeItem?.label ?? "SIRVIU";

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-6">
      <p className="text-sm font-medium text-foreground">{breadcrumb}</p>

      <div className="relative mx-auto w-full max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          disabled
          placeholder="Cari dokumen (segera hadir)"
          aria-label="Cari dokumen"
          className="w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-70"
        />
      </div>

      <button
        type="button"
        aria-label="Notifikasi"
        disabled
        className="relative rounded-md p-2 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Bell className="size-5" aria-hidden="true" />
      </button>
    </header>
  );
}
