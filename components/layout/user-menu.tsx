"use client";

import Link from "next/link";
import { LogOut, User as UserIcon, ChevronsUpDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { CurrentUser } from "@/lib/supabase/session";
import type { Role } from "@/lib/types/domain";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu({ user }: { user: CurrentUser }) {
  const roleLabels = (user.roles as Role[])
    .map((role) => ROLE_LABELS[role])
    .filter(Boolean)
    .join(", ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-xs text-primary-foreground">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {user.name}
          </p>
          <p className="truncate text-xs text-text-muted">
            {roleLabels || "Belum ada role"}
          </p>
        </div>
        <ChevronsUpDown
          className="size-4 shrink-0 text-text-muted"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <UserIcon className="size-4" aria-hidden="true" />
          Profil Saya
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut} className="w-full">
          <DropdownMenuItem
            render={<button type="submit" className="w-full" />}
            nativeButton={true}
            variant="destructive"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Keluar
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
