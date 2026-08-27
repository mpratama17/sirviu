"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function VersionSelector({
  versionNumbers,
  latestVersionNumber,
  selected,
}: {
  versionNumbers: readonly number[];
  latestVersionNumber: number;
  selected: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("v", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={String(selected)} onValueChange={handleChange}>
      <SelectTrigger size="sm" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {versionNumbers.map((v) => (
          <SelectItem key={v} value={String(v)}>
            Versi {v}
            {v === latestVersionNumber ? " (terbaru)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
