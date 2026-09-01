"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { selectInitialRole } from "@/lib/actions/profile";
import { ROLE_LABELS } from "@/lib/constants/roles";

const OPTIONS: readonly {
  value: "ketua_tim" | "dalnis" | "dalmut" | "operator";
  label: string;
  description: string;
}[] = [
  {
    value: "ketua_tim",
    label: "Ketua Tim",
    description:
      "Melakukan reviu awal, upload dokumen LHP, dan revisi bila dikembalikan.",
  },
  {
    value: "dalnis",
    label: "Pengendali Teknis",
    description:
      "Mereviu dokumen dari Ketua Tim di stage 2, menyetujui atau mengembalikan untuk revisi.",
  },
  {
    value: "dalmut",
    label: ROLE_LABELS.dalmut,
    description:
      "Mereviu dokumen di stage 4, menyetujui atau mengembalikan untuk revisi.",
  },
  {
    value: "operator",
    label: "Operator",
    description:
      "Finalisasi dokumen di stage akhir setelah lolos reviu berjenjang.",
  },
];

export function RoleSelectForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    if (!selected) {
      setServerError("Pilih salah satu role terlebih dahulu.");
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("role", selected);
    const result = await selectInitialRole(formData);
    setIsSubmitting(false);

    if (!result.success) {
      setServerError(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const isActive = selected === opt.value;
          return (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-secondary/60",
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={isActive}
                  onChange={() => setSelected(opt.value)}
                  className="size-4 accent-primary"
                />
                <span className="font-medium text-foreground">{opt.label}</span>
              </div>
              <p className="pl-6 text-xs text-muted-foreground">
                {opt.description}
              </p>
            </label>
          );
        })}
      </div>

      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting || !selected} className="w-full">
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Simpan role saya
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Setelah tersimpan, role hanya bisa diubah oleh Admin.
      </p>
    </form>
  );
}
