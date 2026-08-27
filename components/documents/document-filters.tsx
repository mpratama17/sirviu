"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StageFilter } from "@/components/documents/stage-filter";
import { STATUS_LABELS } from "@/lib/constants/stages";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { DocumentStatus, Role, Stage } from "@/lib/types/domain";

const FILTERABLE_STATUSES: DocumentStatus[] = [
  "in_progress",
  "revision_requested",
  "finalized",
];
const FILTERABLE_ROLES: Role[] = ["ketua_tim", "dalnis", "dalmut", "operator"];

function parseStages(param: string | null): Stage[] {
  if (!param) return [];
  return param
    .split(",")
    .map(Number)
    .filter((n): n is Stage => n >= 1 && n <= 7);
}

export function DocumentFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const stages = parseStages(searchParams.get("stage"));
  const status = searchParams.get("status") ?? "";
  const peran = searchParams.get("peran") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const hasActiveFilters =
    q || stages.length > 0 || status || peran || from || to;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val) params.set(key, val);
        else params.delete(key);
      }
      params.delete("page"); // filter berubah → balik ke halaman 1
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  // Debounce search text supaya tidak navigate di setiap keystroke.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const timeout = setTimeout(() => updateParams({ q: q || null }), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function resetFilters() {
    setQ("");
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nomor surat / nama laporan..."
          aria-label="Cari dokumen"
          className="pl-9"
        />
      </div>

      <StageFilter
        value={stages}
        onChange={(next) => updateParams({ stage: next.join(",") || null })}
      />

      <Select
        value={status || undefined}
        onValueChange={(val) => updateParams({ status: val })}
      >
        <SelectTrigger size="sm" className="w-44">
          <SelectValue placeholder="Semua Status" />
        </SelectTrigger>
        <SelectContent>
          {FILTERABLE_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={peran || undefined}
        onValueChange={(val) => updateParams({ peran: val })}
      >
        <SelectTrigger size="sm" className="w-48">
          <SelectValue placeholder="Semua Peran" />
        </SelectTrigger>
        <SelectContent>
          {FILTERABLE_ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              Sebagai {ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={from}
          onChange={(e) => updateParams({ from: e.target.value || null })}
          aria-label="Tanggal upload dari"
          className="w-36"
        />
        <span className="text-sm text-text-muted">–</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => updateParams({ to: e.target.value || null })}
          aria-label="Tanggal upload sampai"
          className="w-36"
        />
      </div>

      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X className="size-4" aria-hidden="true" />
          Reset Filter
        </Button>
      ) : null}
    </div>
  );
}
