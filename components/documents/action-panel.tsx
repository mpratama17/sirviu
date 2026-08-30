"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApproveModal } from "@/components/documents/approve-modal";
import { RejectModal } from "@/components/documents/reject-modal";
import { FormatFixModal } from "@/components/documents/format-fix-modal";
import { UploadRevisionModal } from "@/components/documents/upload-revision-modal";
import { submitDocument, finalizeDocument } from "@/lib/actions/reviews";
import {
  canApprove,
  canFinalize,
  canSubmit,
  canUploadRevision,
  getValidRejectTargets,
} from "@/lib/utils/permissions";
import { STAGE_DEFINITIONS } from "@/lib/constants/stages";
import type { MinimalDocument } from "@/lib/types/domain";

export function ActionPanel({
  doc,
  currentUserId,
  holderName,
  holderRoleLabel,
  lastRejection,
  isAdmin = false,
  isOverride = false,
}: {
  doc: MinimalDocument;
  currentUserId: string;
  holderName: string | null;
  /** Label peran pemegang stage saat ini (mis. "Pengendali Mutu") — ditampilkan di dalam kurung pada state menunggu. */
  holderRoleLabel?: string | null;
  lastRejection: { actorName: string; comment: string } | null;
  /**
   * Deviation dari brief §7 (lihat AGENTS.md & migration ...000007) —
   * admin boleh bertindak sebagai pemegang stage saat ini di dokumen
   * MANAPUN, bukan cuma yang mereka assigned. Stage/status check tetap
   * berlaku sama; ini cuma melonggarkan syarat "userId harus cocok".
   */
  isAdmin?: boolean;
  /** true kalau currentUserId BUKAN pemegang tahap saat ini (dihitung caller dari getCurrentStageAssigneeId) — dipakai untuk banner transparansi, mirror `is_admin_override` di DB. */
  isOverride?: boolean;
}) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [formatFixOpen, setFormatFixOpen] = useState(false);
  const [uploadRevisionOpen, setUploadRevisionOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const nextStageName =
    doc.currentStage < 7
      ? STAGE_DEFINITIONS[(doc.currentStage + 1) as 2 | 3 | 4 | 5 | 6 | 7].name
      : "";

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitDocument(doc.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Dokumen diserahkan ke tahap berikutnya.");
      router.refresh();
    });
  }

  function handleFinalize() {
    startTransition(async () => {
      const result = await finalizeDocument(doc.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Dokumen difinalisasi.");
      router.refresh();
    });
  }

  // Dokumen final — semua orang lihat ini, bukan cuma pemegang stage.
  if (doc.status === "finalized") {
    return (
      <div className="rounded-lg border border-status-finalized/30 bg-status-finalized/5 p-4">
        <p className="text-sm font-medium text-status-finalized">Dokumen Final</p>
        <Button
          className="mt-3 w-full"
          nativeButton={false}
          render={<a href={`/documents/${doc.id}/download`} />}
        >
          Download Dokumen Final
        </Button>
      </div>
    );
  }

  // Banner kecil supaya jelas kalau admin sedang bertindak di luar
  // assignment aslinya (bukan pemalsuan — actor_id tetap admin, ini cuma
  // transparansi UI untuk hal yang sama yang tercatat di is_admin_override).
  const overrideNote = isAdmin && isOverride ? (
    <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
      Anda bertindak sebagai admin, bukan sebagai pemegang tahap ini.
    </p>
  ) : null;

  // KT di stage 1/3/5, in_progress → submit.
  if (canSubmit(doc, currentUserId, isAdmin)) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        {overrideNote}
        <Button className="w-full" onClick={handleSubmit} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Submit ke Reviewer Berikutnya
        </Button>
      </div>
    );
  }

  // KT di stage 1/3/5, revision_requested → upload revisi.
  if (canUploadRevision(doc, currentUserId, isAdmin)) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-status-revision/30 bg-status-revision/5 p-4">
        {overrideNote}
        {lastRejection ? (
          <p className="text-sm text-foreground">
            Dokumen dikembalikan oleh <strong>{lastRejection.actorName}</strong>{" "}
            dengan alasan: {lastRejection.comment}
          </p>
        ) : null}
        <Button className="w-full" onClick={() => setUploadRevisionOpen(true)}>
          Upload Versi Baru
        </Button>
        <UploadRevisionModal
          documentId={doc.id}
          open={uploadRevisionOpen}
          onOpenChange={setUploadRevisionOpen}
        />
      </div>
    );
  }

  // Dalnis (stage 2) / Dalmut (stage 4) → approve / reject.
  if (canApprove(doc, currentUserId, isAdmin)) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        {overrideNote}
        <Button className="w-full" onClick={() => setApproveOpen(true)}>
          Approve — Lanjut ke Stage Berikutnya
        </Button>
        <Button variant="outline" className="w-full" onClick={() => setRejectOpen(true)}>
          Kembalikan untuk Revisi
        </Button>
        <ApproveModal
          documentId={doc.id}
          nextStageName={nextStageName}
          open={approveOpen}
          onOpenChange={setApproveOpen}
        />
        <RejectModal
          documentId={doc.id}
          fromStage={doc.currentStage as 2 | 4 | 6}
          validTargets={getValidRejectTargets(doc.currentStage)}
          open={rejectOpen}
          onOpenChange={setRejectOpen}
        />
      </div>
    );
  }

  // Operator di stage 6 → finalize / format fix / reject.
  if (canFinalize(doc, currentUserId, isAdmin)) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        {overrideNote}
        <Button className="w-full" onClick={handleFinalize} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Finalize Dokumen
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setFormatFixOpen(true)}
          title="Upload versi hasil perbaikan format Anda, lalu finalize"
        >
          Format Fix & Finalize
        </Button>
        <Button
          variant="ghost"
          className="w-full text-destructive"
          onClick={() => setRejectOpen(true)}
        >
          Kembalikan untuk Revisi Konten
        </Button>
        <RejectModal
          documentId={doc.id}
          fromStage={6}
          validTargets={getValidRejectTargets(6)}
          open={rejectOpen}
          onOpenChange={setRejectOpen}
        />
        <FormatFixModal documentId={doc.id} open={formatFixOpen} onOpenChange={setFormatFixOpen} />
      </div>
    );
  }

  // Bukan pemegang stage saat ini (atau bukan role yang relevan).
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/50 p-3">
      <Clock className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
      <p className="text-xs text-muted-foreground">
        Menunggu aksi dari{" "}
        <strong className="font-medium text-foreground">
          {holderName ?? "pemegang stage saat ini"}
        </strong>
        {holderRoleLabel ? ` (${holderRoleLabel})` : ""}.
      </p>
    </div>
  );
}
