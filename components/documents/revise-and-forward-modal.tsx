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
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/documents/file-dropzone";
import { reviewerReviseAndForward } from "@/lib/actions/reviews";

/**
 * Dalnis/Dalmut upload versi hasil koreksi + langsung teruskan ke
 * reviewer berikutnya. Ditambahkan Aug 2026 saat workflow 5-stage.
 * Pola sama seperti FormatFixModal (Operator).
 */
export function ReviseAndForwardModal({
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
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!file) {
      setFileError("File revisi wajib diupload.");
      return;
    }
    setFileError(undefined);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("comment", comment);

    startTransition(async () => {
      const result = await reviewerReviseAndForward(documentId, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Dokumen direvisi & diteruskan${nextStageName ? ` ke ${nextStageName}` : ""}.`);
      setFile(null);
      setComment("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisi &amp; Teruskan</DialogTitle>
          <DialogDescription>
            Upload versi baru hasil koreksi Anda. Dokumen langsung diteruskan
            {nextStageName ? ` ke ${nextStageName}` : " ke reviewer berikutnya"}
            {" "}tanpa melalui Ketua Tim.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FileDropzone file={file} onChange={setFile} error={fileError} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revise-comment">Catatan revisi (opsional)</Label>
            <Textarea
              id="revise-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              // `rows` tidak berpengaruh: Textarea pakai `field-sizing-content`
              // (components/ui/textarea.tsx), jadi tinggi ikut isi dan hanya
              // min/max-height yang menentukan. Catatan reviu di kasus nyata
              // panjang — mulai lega, lalu scroll sendiri, bukan mendorong
              // dialog melewati layar.
              className="min-h-48 max-h-[45vh]"
              placeholder="Ringkas apa yang Anda perbaiki, biar reviewer berikutnya tahu."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Upload &amp; Teruskan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
