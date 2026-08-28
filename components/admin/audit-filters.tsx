"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCombobox, type SelectableUser } from "@/components/documents/user-combobox";
import { AUDIT_ACTIONS } from "@/lib/constants/audit";
import { ACTION_LABELS } from "@/lib/constants/stages";

export function AuditFilters({ users }: { users: readonly SelectableUser[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const action = searchParams.get("action") ?? "";
  const actorId = searchParams.get("actor") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const hasActiveFilters = q || action || actorId || from || to;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val) params.set(key, val);
        else params.delete(key);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

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

  const exportHref = `/admin/audit/export?${searchParams.toString()}`;

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
          placeholder="Cari nomor surat..."
          aria-label="Cari nomor surat"
          className="pl-9"
        />
      </div>

      <Select value={action || undefined} onValueChange={(v) => updateParams({ action: v })}>
        <SelectTrigger size="sm" className="w-44">
          <SelectValue placeholder="Semua Aksi" />
        </SelectTrigger>
        <SelectContent>
          {AUDIT_ACTIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {ACTION_LABELS[a] ?? a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-56">
        <UserCombobox
          users={users}
          value={actorId || undefined}
          onChange={(id) => updateParams({ actor: id })}
          placeholder="Semua User"
          includeInactive
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={from}
          onChange={(e) => updateParams({ from: e.target.value || null })}
          aria-label="Tanggal dari"
          className="w-36"
        />
        <span className="text-sm text-text-muted">–</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => updateParams({ to: e.target.value || null })}
          aria-label="Tanggal sampai"
          className="w-36"
        />
      </div>

      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X className="size-4" aria-hidden="true" />
          Reset Filter
        </Button>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<a href={exportHref} />}
        className="ml-auto"
      >
        <Download className="size-4" aria-hidden="true" />
        Export CSV
      </Button>
    </div>
  );
}
