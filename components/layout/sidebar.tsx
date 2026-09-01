"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVisibleNavGroups, type NavItem } from "@/components/layout/nav-items";
import { UserMenu } from "@/components/layout/user-menu";
import type { CurrentUser } from "@/lib/supabase/session";

/**
 * Aktif kalau pathname sama DAN setiap search param yang ada di
 * `item.href` cocok di searchParams saat ini. Item tanpa search params
 * (contoh: Dashboard `/dashboard`) hanya aktif kalau searchParams saat
 * ini tidak punya `scope` — supaya `/dashboard` (Dashboard) dan
 * `/dashboard?scope=mine` (Dokumen Saya) tidak keduanya highlight
 * berbarengan.
 */
function isNavItemActive(
  itemHref: string,
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  const [itemPath, itemQuery] = itemHref.split("?");
  if (itemPath !== pathname) return false;
  const itemParams = new URLSearchParams(itemQuery ?? "");
  for (const [key, value] of itemParams.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  // Item tanpa `scope` di href-nya tidak boleh match kalau searchParams
  // saat ini punya `scope` — kalau tidak, Dashboard akan ikut aktif saat
  // Dokumen Saya di-buka.
  if (!itemParams.has("scope") && searchParams.has("scope")) return false;
  return true;
}

function NavLink({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? null : item.label}
    </Link>
  );
}

/** localStorage key untuk persist state collapse — satu sumber kebenaran, dipakai AppShell. */
export const COLLAPSE_STORAGE_KEY = "sirviu:sidebar-collapsed";

export function Sidebar({
  user,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  user: CurrentUser;
  /** Rail mode (icon-only, w-16) — cuma berlaku di desktop, dikontrol AppShell. */
  collapsed?: boolean;
  /** Tombol toggle di header sidebar — undefined berarti toggle disembunyikan (dipakai drawer mobile, yang sudah punya cara sendiri untuk ditutup). */
  onToggleCollapse?: () => void;
  /** Dipanggil saat link diklik — dipakai AppShell untuk nutup drawer mobile. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { main, admin } = getVisibleNavGroups(user.roles);

  return (
    <aside
      className={cn(
        "flex h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-sidebar-border px-4 py-3",
          collapsed && "flex-col gap-2 px-2",
        )}
      >
        <div className={cn("flex items-center gap-2.5", collapsed && "flex-col gap-2")}>
          {/* Lambang resmi (permintaan user) — portrait 319x480, jauh lebih
              tinggi dari lebar, jadi slotnya bukan lagi kotak seperti monogram
              "S" sebelumnya. */}
          <Image
            src="/logo-sirviu.png"
            alt="Lambang Irban III"
            width={29}
            height={44}
            className="h-11 w-auto shrink-0"
            priority
          />
          {collapsed ? null : (
            <div className="min-w-0 flex-1 leading-none">
              <div className="text-sm font-bold tracking-tight text-sidebar-foreground">
                SIRVIU
              </div>
              <div className="mt-0.5 text-[10px] leading-none text-text-muted">
                Reviu Berjenjang LHP
              </div>
            </div>
          )}
        </div>
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
            title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
            className={cn(
              "shrink-0 rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              !collapsed && "ml-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      <nav className={cn("flex-1 space-y-0.5 overflow-y-auto p-2", collapsed && "relative")}>
        {main.map((item) => (
          <NavLink
            key={item.label}
            item={item}
            isActive={isNavItemActive(item.href, pathname, searchParams)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}

        {admin.length > 0 ? (
          <>
            {collapsed ? (
              <div className="my-2 border-t border-sidebar-border" role="separator" />
            ) : (
              <div className="mt-4 mb-1 px-3 pt-2 text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                Admin
              </div>
            )}
            {admin.map((item) => (
              <NavLink
                key={item.label}
                item={item}
                isActive={isNavItemActive(item.href, pathname, searchParams)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </>
        ) : null}
      </nav>

      <div className={cn("border-t border-sidebar-border p-3", collapsed && "px-2")}>
        <UserMenu user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}
