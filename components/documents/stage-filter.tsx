"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ALL_STAGES, STAGE_DEFINITIONS } from "@/lib/constants/stages";
import type { Stage } from "@/lib/types/domain";

export function StageFilter({
  value,
  onChange,
}: {
  value: readonly Stage[];
  onChange: (stages: Stage[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(stage: Stage) {
    if (value.includes(stage)) {
      onChange(value.filter((s) => s !== stage));
    } else {
      onChange([...value, stage].sort());
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="justify-between font-normal" />
        }
      >
        {value.length === 0 ? "Semua Stage" : `${value.length} Stage dipilih`}
        <ChevronDown className="size-4 opacity-50" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex flex-col gap-1">
          {ALL_STAGES.map((stage) => (
            <label
              key={stage}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
            >
              <Checkbox
                checked={value.includes(stage)}
                onCheckedChange={() => toggle(stage)}
              />
              Stage {stage}: {STAGE_DEFINITIONS[stage].name}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
