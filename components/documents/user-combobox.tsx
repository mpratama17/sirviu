"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types/domain";

export interface SelectableUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  isActive: boolean;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserCombobox({
  users,
  role,
  value,
  onChange,
  placeholder = "Pilih user...",
  disabledIds,
}: {
  users: readonly SelectableUser[];
  role: Role;
  value: string | undefined;
  onChange: (userId: string) => void;
  placeholder?: string;
  /** User yang sudah dipilih di dropdown lain — dicegah dipilih dobel. */
  disabledIds?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const candidates = users.filter((u) => u.isActive && u.roles.includes(role));
  const selected = candidates.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          />
        }
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar className="size-5">
              <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                {initials(selected.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari nama atau email..." />
          <CommandList>
            <CommandEmpty>Tidak ada user ditemukan.</CommandEmpty>
            <CommandGroup>
              {candidates.map((user) => {
                const isDisabled = disabledIds?.includes(user.id) && user.id !== value;
                return (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.email}`}
                    disabled={isDisabled}
                    onSelect={() => {
                      onChange(user.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        value === user.id ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    <Avatar className="size-5">
                      <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{user.name}</span>
                      <span className="truncate text-xs text-text-muted">
                        {user.email}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
