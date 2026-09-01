"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Sidebar, COLLAPSE_STORAGE_KEY } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { NotificationItem } from "@/components/layout/notification-bell";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/supabase/session";

/** Same-tab tidak memicu event `storage` bawaan browser (itu cuma untuk tab
 * LAIN) — event custom ini yang dipakai `toggleCollapsed` di bawah supaya
 * `useSyncExternalStore` tahu harus re-read localStorage di tab yang sama. */
const COLLAPSE_CHANGE_EVENT = "sirviu:sidebar-collapsed-change";

function subscribeToCollapsed(callback: () => void) {
  window.addEventListener(COLLAPSE_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(COLLAPSE_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getCollapsedSnapshot(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Snapshot server SELALU false (localStorage tidak ada di server) — ini
 * yang mencegah hydration mismatch, bukan effect+setState. */
function getCollapsedServerSnapshot(): boolean {
  return false;
}

/**
 * Sidebar jadi off-canvas drawer di mobile (< lg), fixed biasa di desktop —
 * DESIGN_BRIEF §7. State drawer di sini karena Header (hamburger trigger)
 * dan Sidebar (drawer panel) perlu share state, dan keduanya dipanggil
 * dari layout.tsx yang Server Component (tidak bisa pegang useState).
 *
 * `collapsed` (permintaan user: toggle buka/tutup sidebar) terpisah dari
 * `mobileOpen` — cuma berlaku desktop (rail icon-only, bukan off-canvas;
 * mobile sudah punya cara sendiri untuk ditutup lewat backdrop/hamburger).
 * Di-persist ke localStorage lewat `useSyncExternalStore` (API resmi React
 * untuk baca external store), bukan `useEffect` + `setState` di mount —
 * pola itu dilarang ESLint (`react-hooks/set-state-in-effect`) karena
 * `useSyncExternalStore` sudah menangani kasus persis ini dengan benar,
 * termasuk hydration (server snapshot selalu `false`, client sync begitu
 * mount tanpa render tambahan yang terlihat).
 */
export function AppShell({
  user,
  notifications,
  unreadCount,
  children,
}: {
  user: CurrentUser;
  notifications: readonly NotificationItem[];
  unreadCount: number;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(
    subscribeToCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );

  function toggleCollapsed() {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "0" : "1");
      window.dispatchEvent(new Event(COLLAPSE_CHANGE_EVENT));
    } catch {
      // localStorage bisa gagal diakses (private mode dsb) — snapshot-nya
      // sendiri juga selalu balik `false` kalau ini gagal, jadi toggle
      // memang tidak berefek di kondisi itu (bukan cuma tidak persist).
    }
  }

  return (
    <div className="flex h-svh">
      {mobileOpen ? (
        <div
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
        />
      ) : null}

      {/* Drawer mobile (< lg) — off-canvas, selalu versi penuh (tidak ada
          rail collapsed di mobile, sudah punya cara sendiri untuk ditutup
          lewat backdrop/hamburger). */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar user={user} onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* Rail desktop (>= lg) — instance TERPISAH dari drawer mobile di
          atas, supaya cuma satu yang pernah visible di satu breakpoint
          (dua instance sekaligus lewat CSS display toggle akan dobel). */}
      <div className="hidden lg:block">
        <Sidebar
          user={user}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          notifications={notifications}
          unreadCount={unreadCount}
        />
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
