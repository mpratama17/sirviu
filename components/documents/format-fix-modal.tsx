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
import { formatFixAndFinalize } from "@/lib/actions/reviews";

export function FormatFixModal({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: string;
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
      setFileError("File hasil perbaikan format wajib diupload.");
      return;
    }
    setFileError(undefined);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("comment", comment);

    startTransition(async () => {
      const result = await formatFixAndFinalize(documentId, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Dokumen difinalisasi dengan versi hasil perbaikan format.");
      setFile(null);
      setComment("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Format Fix & Finalize</DialogTitle>
          <DialogDescription>
            Upload versi hasil perbaikan format Anda (spasi, header, dsb),
            lalu dokumen langsung difinalisasi.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FileDropzone file={file} onChange={setFile} error={fileError} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="format-fix-comment">Catatan (opsional)</Label>
            <Textarea
              id="format-fix-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Upload & Finalize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
