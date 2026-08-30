/**
 * Definisi menu sidebar. `requiredRole` menentukan visibility — item tanpa
 * `requiredRole` tampil untuk semua user yang authenticated.
 *
 * Catatan: "Dashboard" dan "Dokumen Saya" (DESIGN_BRIEF §5.2) untuk saat
 * ini menuju halaman yang sama — keduanya jadi satu view filterable begitu
 * filter dashboard dibangun (Milestone 2, brief §9). Dipisah lagi kalau
 * nanti ternyata butuh dua page yang benar-benar beda.
 */
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, FolderOpen, Upload, Users, ScrollText } from "lucide-react";
import type { Role } from "@/lib/types/domain";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  requiredRole?: Role;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard?scope=mine", label: "Dokumen Saya", icon: FolderOpen },
  {
    href: "/documents/new",
    label: "Upload Dokumen",
    icon: Upload,
    requiredRole: "ketua_tim",
  },
  {
    href: "/admin/users",
    label: "Manajemen Pengguna",
    icon: Users,
    requiredRole: "admin",
  },
  {
    href: "/admin/audit",
    label: "Audit Trail",
    icon: ScrollText,
    requiredRole: "admin",
  },
] as const;

export function getVisibleNavItems(roles: readonly string[]): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.requiredRole || roles.includes(item.requiredRole),
  );
}

/**
 * Sama seperti `getVisibleNavItems`, tapi dipisah jadi grup utama vs admin —
 * sidebar merender grup admin dengan section label terpisah (DESIGN_BRIEF
 * mockup terbaru).
 */
export function getVisibleNavGroups(roles: readonly string[]): {
  main: NavItem[];
  admin: NavItem[];
} {
  const visible = getVisibleNavItems(roles);
  return {
    main: visible.filter((item) => item.requiredRole !== "admin"),
    admin: visible.filter((item) => item.requiredRole === "admin"),
  };
}
