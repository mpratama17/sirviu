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
import { uploadRevision } from "@/lib/actions/documents";

export function UploadRevisionModal({
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
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!file) {
      setFileError("File dokumen wajib diupload.");
      return;
    }
    setFileError(undefined);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("uploadNotes", notes);

    startTransition(async () => {
      const result = await uploadRevision(documentId, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Versi baru berhasil diupload.");
      setFile(null);
      setNotes("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Versi Baru</DialogTitle>
          <DialogDescription>
            Upload versi revisi berdasarkan catatan reviewer. Dokumen akan
            siap di-submit ulang setelah ini.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FileDropzone file={file} onChange={setFile} error={fileError} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revision-notes">Catatan (opsional)</Label>
            <Textarea
              id="revision-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-48 max-h-[45vh]"
              placeholder="Ringkasan perubahan yang dilakukan (opsional)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Upload Versi Baru
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
