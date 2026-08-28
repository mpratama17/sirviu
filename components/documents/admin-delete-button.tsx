"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminDeleteDocumentSchema } from "@/lib/validators/documents";
import { adminDeleteDocument } from "@/lib/actions/documents";

const REASON_MIN = 10;
const REASON_MAX = 2000;

/**
 * Hard delete oleh admin (deviation dari brief, lihat AGENTS.md & migration
 * ...000007) — berbeda dari `DeleteDocumentButton` (khusus submitter
 * sendiri, stage 1, belum pernah disubmit). Ini bisa hapus dokumen APAPUN,
 * karena itu wajib alasan (aksi ireversibel — dokumen, versi, dan riwayat
 * transisinya sungguh-sungguh terhapus, cuma snapshot ringkas yang selamat
 * di deleted_documents_log).
 */
export function AdminDeleteButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const parsed = adminDeleteDocumentSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Alasan tidak valid.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await adminDeleteDocument(documentId, parsed.data.reason);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Dokumen dihapus permanen.");
      router.push("/dashboard");
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <ShieldAlert className="size-4" aria-hidden="true" />
        Hapus Dokumen (Admin)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Dokumen Permanen</DialogTitle>
            <DialogDescription>
              Dokumen, seluruh versi file, dan riwayat reviunya akan
              terhapus PERMANEN — tidak dapat dibatalkan. Hanya catatan
              ringkas (siapa, kapan, kenapa) yang tersimpan di log admin.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-delete-reason">Alasan Penghapusan</Label>
            <Textarea
              id="admin-delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={REASON_MAX}
              placeholder="Contoh: dokumen duplikat, salah upload, diminta dibatalkan oleh..."
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Minimal {REASON_MIN} karakter.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Ya, Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
