"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleDot, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_STAGES, STAGE_DEFINITIONS, ACTION_LABELS } from "@/lib/constants/stages";
import type { Stage } from "@/lib/types/domain";

export interface TimelineTransition {
  id: string;
  fromStage: number | null;
  toStage: number;
  action: string;
  actorName: string;
  comment: string | null;
  versionNumber: number | null;
  isSuperseded: boolean;
  createdAt: string;
}

type StageStatus = "current" | "passed" | "revision" | "untouched";

function getStageStatus(
  stage: Stage,
  currentStage: Stage,
  status: string,
  transitions: readonly TimelineTransition[],
): StageStatus {
  if (stage === currentStage) return "current";
  const rejectedFromHere = transitions.some(
    (t) => t.action === "reject" && t.fromStage === stage,
  );
  if (rejectedFromHere) return "revision";
  if (stage < currentStage || (stage === 7 && status === "finalized")) return "passed";
  return "untouched";
}

const STATUS_ICON: Record<StageStatus, typeof Check> = {
  current: CircleDot,
  passed: Check,
  revision: Undo2,
  untouched: CircleDot,
};

const STATUS_CLASSES: Record<StageStatus, string> = {
  current: "border-status-progress bg-status-progress/10 text-status-progress",
  passed: "border-status-approved bg-status-approved/10 text-status-approved",
  revision: "border-status-revision bg-status-revision/10 text-status-revision",
  untouched: "border-border bg-card text-text-muted",
};

export function StageTimeline({
  currentStage,
  status,
  transitions,
}: {
  currentStage: Stage;
  status: string;
  transitions: readonly TimelineTransition[];
}) {
  const [expanded, setExpanded] = useState<Stage | null>(currentStage);

  return (
    <ol className="flex flex-col">
      {ALL_STAGES.map((stage) => {
        const stageStatus = getStageStatus(stage, currentStage, status, transitions);
        const Icon = STATUS_ICON[stageStatus];
        const isOpen = expanded === stage;
        const stageTransitions = transitions.filter(
          (t) => t.toStage === stage || t.fromStage === stage,
        );
        const isLast = stage === 7;

        return (
          <li key={stage} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden="true"
                className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border"
              />
            ) : null}

            <span
              className={cn(
                "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-card",
                STATUS_CLASSES[stageStatus],
                stageStatus === "current" && "animate-pulse",
              )}
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : stage)}
                className="flex w-full items-center justify-between gap-2 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium text-foreground">
                  Stage {stage}: {STAGE_DEFINITIONS[stage].name}
                </span>
                {stageTransitions.length > 0 ? (
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-text-muted transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                ) : null}
              </button>

              {isOpen && stageTransitions.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-2">
                  {stageTransitions.map((t) => (
                    <li
                      key={t.id}
                      className={cn(
                        "rounded-md border border-border bg-secondary/50 p-2 text-xs",
                        t.isSuperseded && "text-text-muted line-through decoration-text-muted",
                      )}
                    >
                      <p className={cn("font-medium", !t.isSuperseded && "text-foreground")}>
                        {ACTION_LABELS[t.action] ?? t.action} — {t.actorName}
                        {t.versionNumber ? ` (v${t.versionNumber})` : ""}
                      </p>
                      <p className="text-text-muted no-underline">
                        {new Date(t.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {t.comment ? <p className="mt-1 no-underline">{t.comment}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
