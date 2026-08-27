import { Construction } from "lucide-react";

/** Placeholder untuk halaman yang route-nya sudah ada tapi fitur belum dibangun. */
export function ComingSoon({
  title,
  milestone,
}: {
  title: string;
  milestone: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-24 text-center">
        <Construction className="size-10 text-text-muted" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Halaman ini akan tersedia di {milestone}.
        </p>
      </div>
    </div>
  );
}
