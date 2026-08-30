"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDefaultRejectTarget, STAGE_DEFINITIONS } from "@/lib/constants/stages";
import { rejectReviewSchema } from "@/lib/validators/reviews";
import { rejectReview } from "@/lib/actions/reviews";
import type { Stage } from "@/lib/types/domain";

const COMMENT_MIN = 10;
const COMMENT_MAX = 2000;

export function RejectModal({
  documentId,
  fromStage,
  validTargets,
  open,
  onOpenChange,
}: {
  documentId: string;
  fromStage: 2 | 3 | 4;
  validTargets: readonly Stage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [targetStage, setTargetStage] = useState<Stage>(
    getDefaultRejectTarget(fromStage),
  );
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReject() {
    const parsed = rejectReviewSchema.safeParse({ targetStage, comment });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Data tidak valid.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await rejectReview(documentId, targetStage, comment);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Dokumen dikembalikan untuk revisi.");
      setComment("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kembalikan untuk Revisi</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reject-target">Kembalikan ke Stage</Label>
            <Select
              value={String(targetStage)}
              onValueChange={(val) => setTargetStage(Number(val) as Stage)}
            >
              <SelectTrigger id="reject-target" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validTargets.map((stage) => (
                  <SelectItem key={stage} value={String(stage)}>
                    Stage {stage}: {STAGE_DEFINITIONS[stage].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reject-comment">Alasan Revisi</Label>
            <Textarea
              id="reject-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              rows={4}
              aria-invalid={!!error}
              aria-describedby="reject-comment-count"
            />
            <p id="reject-comment-count" className="text-right text-xs text-text-muted tabular-nums">
              {comment.trim().length}/{COMMENT_MIN} karakter minimum
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2 rounded-md bg-secondary p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Semua approval di stage setelah target akan direset. Reviewer di
              stage tersebut perlu review ulang saat dokumen naik kembali.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleReject} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Kembalikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
