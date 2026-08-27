import { Badge } from "@/components/ui/badge";
import { STAGE_DEFINITIONS } from "@/lib/constants/stages";
import type { Stage } from "@/lib/types/domain";

/** Badge "Stage N: <Nama Tahap>" — DESIGN_BRIEF §5.3. */
export function StageBadge({ stage }: { stage: Stage }) {
  const def = STAGE_DEFINITIONS[stage];
  return (
    <Badge variant="outline" className="font-normal">
      Stage {stage}: {def.name}
    </Badge>
  );
}
