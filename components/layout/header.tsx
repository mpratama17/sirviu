"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";

/**
 * Breadcrumb diturunkan dari NAV_ITEMS berdasarkan path aktif — cukup untuk
 * halaman-halaman top-level. Halaman detail (mis. /documents/[id]) bisa
 * override nanti kalau dibutuhkan breadcrumb bertingkat.
 *
 * Search: mengarah ke filter `q` dashboard yang sudah ada
 * (`app/(app)/dashboard/page.tsx`) — Enter dari mana pun langsung pindah ke
 * /dashboard?q=... Bukan dropdown hasil real-time, tapi bukan dekorasi mati
 * juga (sebelumnya `disabled` dengan placeholder "segera hadir").
 * Notifikasi masih placeholder — in-app notification masuk Future
 * Enhancement (brief §10), badge sengaja dikosongkan sesuai DESIGN_BRIEF §5.2.
 */
export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const activeItem = NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  const breadcrumb = activeItem?.label ?? "SIRVIU";

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = query.trim();
    router.push(q ? `/dashboard?q=${encodeURIComponent(q)}` : "/dashboard");
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4 sm:gap-4 sm:px-6">
      {onMenuClick ? (
        <button
          type="button"
          aria-label="Buka menu"
          onClick={onMenuClick}
          className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      ) : null}

      <p className="shrink-0 text-sm font-medium text-foreground">{breadcrumb}</p>

      <div className="relative mx-auto hidden w-full max-w-md sm:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Cari dokumen berdasarkan nomor surat atau nama laporan..."
          aria-label="Cari dokumen"
          className="w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-text-muted focus:border-primary focus:ring-3 focus:ring-primary/15"
        />
      </div>

      <button
        type="button"
        aria-label="Notifikasi"
        disabled
        className="relative ml-auto shrink-0 rounded-md p-2 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:ml-0"
      >
        <Bell className="size-5" aria-hidden="true" />
      </button>
    </header>
  );
}
