"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Drop-in replacement untuk `<Input type="password" />` dengan tombol
 * reveal/hide di kanan. Forward semua props ke `Input`, jadi kompatibel
 * dengan `register(...)` react-hook-form.
 *
 * `type` awal tidak dari prop — komponen ini memang khusus untuk password.
 * Padding kanan ekstra supaya teks tidak nabrak ikon.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = React.useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={visible}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        tabIndex={-1}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
});
