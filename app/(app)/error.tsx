"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppSegmentError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <AlertTriangle className="size-10 text-status-revision" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-foreground">Terjadi kesalahan.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Silakan coba lagi. Kalau masih terjadi, hubungi admin.
        </p>
      </div>
      <Button onClick={() => retry()}>Coba Lagi</Button>
    </div>
  );
}
