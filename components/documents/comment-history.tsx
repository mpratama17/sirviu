import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { STAGE_DEFINITIONS } from "@/lib/constants/stages";
import type { TimelineTransition } from "@/components/documents/stage-timeline";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Riwayat semua komentar reject — DESIGN_BRIEF §5.5.D, accordion collapsed default. */
export function CommentHistory({
  transitions,
}: {
  transitions: readonly TimelineTransition[];
}) {
  const rejections = transitions.filter((t) => t.action === "reject" && t.comment);

  if (rejections.length === 0) return null;

  return (
    <Accordion className="rounded-lg border border-border bg-card">
      <AccordionItem value="comments">
        <AccordionTrigger className="px-4">
          Riwayat Komentar ({rejections.length})
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3 px-4">
          {rejections.map((t) => (
            <div key={t.id} className="flex gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                  {initials(t.actorName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {t.actorName}{" "}
                  <span className="font-normal text-text-muted">
                    · {new Date(t.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </p>
                <p className="text-xs text-text-muted">
                  Dari Stage {t.fromStage}: {t.fromStage ? STAGE_DEFINITIONS[t.fromStage as 1|2|3|4|5|6|7].name : ""}
                  {t.versionNumber ? ` · v${t.versionNumber}` : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t.comment}</p>
              </div>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
