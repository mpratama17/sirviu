import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card py-24 text-center">
      <Icon className="size-10 text-text-muted" aria-hidden="true" />
      <p className="max-w-sm text-sm text-muted-foreground">{title}</p>
      {action ? (
        <Button
          size="sm"
          className="mt-1"
          nativeButton={false}
          render={<Link href={action.href} />}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
