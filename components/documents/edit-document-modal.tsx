"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserCombobox, type SelectableUser } from "@/components/documents/user-combobox";
import {
  editDocumentMetadataSchema,
  type EditDocumentMetadataInput,
} from "@/lib/validators/documents";
import { adminUpdateDocumentMetadata } from "@/lib/actions/documents";

/**
 * Edit metadata dokumen oleh admin — deviation dari brief, lihat AGENTS.md
 * & migration ...000007. Bukan bagian dari alur reviu (tidak menulis ke
 * stage_transitions), jadi bisa dipakai di stage/status manapun — perbaikan
 * typo nomor surat tugas atau reassign reviewer yang salah/cuti.
 */
export function EditDocumentModal({
  documentId,
  users,
  initial,
}: {
  documentId: string;
  users: readonly SelectableUser[];
  initial: {
    nomorSuratTugas: string;
    namaLaporan: string;
    ketuaTimId: string;
    dalnisId: string;
    dalmutId: string;
    operatorId: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditDocumentMetadataInput>({
    resolver: zodResolver(editDocumentMetadataSchema),
    defaultValues: { ...initial, reason: "" },
  });

  const selectedReviewers = [
    watch("ketuaTimId"),
    watch("dalnisId"),
    watch("dalmutId"),
    watch("operatorId"),
  ].filter(Boolean);

  function onOpenChange(next: boolean) {
    if (next) reset({ ...initial, reason: "" });
    setOpen(next);
  }

  function onSubmit(values: EditDocumentMetadataInput) {
    const formData = new FormData();
    formData.set("nomorSuratTugas", values.nomorSuratTugas);
    formData.set("namaLaporan", values.namaLaporan);
    formData.set("ketuaTimId", values.ketuaTimId);
    formData.set("dalnisId", values.dalnisId);
    formData.set("dalmutId", values.dalmutId);
    formData.set("operatorId", values.operatorId);
    formData.set("reason", values.reason ?? "");

    startTransition(async () => {
      const result = await adminUpdateDocumentMetadata(documentId, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Metadata dokumen berhasil diperbarui.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => onOpenChange(true)}>
        <Pencil className="size-4" aria-hidden="true" />
        Edit Metadata (Admin)
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Metadata Dokumen</DialogTitle>
            <DialogDescription>
              Perbaikan data, bukan bagian dari alur reviu — tidak
              menghasilkan entri timeline baru. Perubahan dicatat terpisah
              di log admin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-nomorSuratTugas">Nomor Surat Tugas</Label>
              <Input id="edit-nomorSuratTugas" {...register("nomorSuratTugas")} />
              {errors.nomorSuratTugas ? (
                <p role="alert" className="text-sm text-destructive">
                  {errors.nomorSuratTugas.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-namaLaporan">Nama Laporan</Label>
              <Input id="edit-namaLaporan" {...register("namaLaporan")} />
              {errors.namaLaporan ? (
                <p role="alert" className="text-sm text-destructive">
                  {errors.namaLaporan.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Ketua Tim</Label>
                <Controller
                  control={control}
                  name="ketuaTimId"
                  render={({ field }) => (
                    <UserCombobox
                      users={users}
                      role="ketua_tim"
                      value={field.value}
                      onChange={field.onChange}
                      disabledIds={selectedReviewers}
                    />
                  )}
                />
                {errors.ketuaTimId ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.ketuaTimId.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Pengendali Teknis (Dalnis)</Label>
                <Controller
                  control={control}
                  name="dalnisId"
                  render={({ field }) => (
                    <UserCombobox
                      users={users}
                      role="dalnis"
                      value={field.value}
                      onChange={field.onChange}
                      disabledIds={selectedReviewers}
                    />
                  )}
                />
                {errors.dalnisId ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.dalnisId.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Pengendali Mutu (Dalmut)</Label>
                <Controller
                  control={control}
                  name="dalmutId"
                  render={({ field }) => (
                    <UserCombobox
                      users={users}
                      role="dalmut"
                      value={field.value}
                      onChange={field.onChange}
                      disabledIds={selectedReviewers}
                    />
                  )}
                />
                {errors.dalmutId ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.dalmutId.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Operator</Label>
                <Controller
                  control={control}
                  name="operatorId"
                  render={({ field }) => (
                    <UserCombobox
                      users={users}
                      role="operator"
                      value={field.value}
                      onChange={field.onChange}
                      disabledIds={selectedReviewers}
                    />
                  )}
                />
                {errors.operatorId ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.operatorId.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-reason">Alasan Perubahan (opsional)</Label>
              <Textarea
                id="edit-reason"
                className="min-h-24 max-h-[35vh]"
                placeholder="Contoh: salah ketik nomor surat tugas, Dalnis sedang cuti..."
                {...register("reason")}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
