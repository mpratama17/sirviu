"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { Role } from "@/lib/types/domain";

const ALL_ROLE_VALUES: Role[] = ["ketua_tim", "dalnis", "dalmut", "operator", "admin"];

export function RoleMultiSelect({
  value,
  onChange,
}: {
  value: readonly Role[];
  onChange: (roles: Role[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(role: Role) {
    if (value.includes(role)) {
      onChange(value.filter((r) => r !== role));
    } else {
      onChange([...value, role]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="w-full justify-between font-normal" />}
      >
        {value.length === 0 ? "Pilih role..." : value.map((r) => ROLE_LABELS[r]).join(", ")}
        <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex flex-col gap-1">
          {ALL_ROLE_VALUES.map((role) => (
            <label
              key={role}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
            >
              <Checkbox checked={value.includes(role)} onCheckedChange={() => toggle(role)} />
              {ROLE_LABELS[role]}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
