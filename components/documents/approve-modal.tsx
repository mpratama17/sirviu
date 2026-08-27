"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveReview } from "@/lib/actions/reviews";

/** Modal Approve — DESIGN_BRIEF §5.6. */
export function ApproveModal({
  documentId,
  nextStageName,
  open,
  onOpenChange,
}: {
  documentId: string;
  nextStageName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      const result = await approveReview(documentId, comment);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Dokumen disetujui.");
      setComment("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Dokumen</DialogTitle>
          <DialogDescription>
            Anda akan meneruskan dokumen ini ke {nextStageName}. Lanjutkan?
          </DialogDescription>
        </DialogHeader>

        <Textarea
          placeholder="Catatan (opsional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button
            className="bg-status-approved text-white hover:bg-status-approved/90"
            onClick={handleApprove}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Ya, Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
