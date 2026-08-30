"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getVisibleNavGroups, type NavItem } from "@/components/layout/nav-items";
import { UserMenu } from "@/components/layout/user-menu";
import type { CurrentUser } from "@/lib/supabase/session";

function NavLink({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

export function Sidebar({
  user,
  onNavigate,
}: {
  user: CurrentUser;
  /** Dipanggil saat link diklik — dipakai AppShell untuk nutup drawer mobile. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { main, admin } = getVisibleNavGroups(user.roles);

  return (
    <aside className="flex h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          S
        </div>
        <div className="min-w-0 leading-none">
          <div className="text-sm font-bold tracking-tight text-sidebar-foreground">
            SIRVIU
          </div>
          <div className="mt-0.5 text-[10px] leading-none text-text-muted">
            Reviu Berjenjang LHP
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {main.map((item) => (
          <NavLink
            key={item.label}
            item={item}
            isActive={pathname === item.href}
            onNavigate={onNavigate}
          />
        ))}

        {admin.length > 0 ? (
          <>
            <div className="mt-4 mb-1 px-3 pt-2 text-[10px] font-semibold tracking-wider text-text-muted uppercase">
              Admin
            </div>
            {admin.map((item) => (
              <NavLink
                key={item.label}
                item={item}
                isActive={pathname === item.href}
                onNavigate={onNavigate}
              />
            ))}
          </>
        ) : null}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
