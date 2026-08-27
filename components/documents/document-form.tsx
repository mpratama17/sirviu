"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCombobox, type SelectableUser } from "@/components/documents/user-combobox";
import { FileDropzone } from "@/components/documents/file-dropzone";
import { createDocument } from "@/lib/actions/documents";
import {
  documentMetadataSchema,
  type DocumentMetadataInput,
} from "@/lib/validators/documents";

export function DocumentForm({
  users,
  currentUserId,
}: {
  users: readonly SelectableUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<DocumentMetadataInput>({
    resolver: zodResolver(documentMetadataSchema),
    defaultValues: {
      nomorSuratTugas: "",
      namaLaporan: "",
      ketuaTimId: currentUserId,
      dalnisId: "",
      dalmutId: "",
      operatorId: "",
      uploadNotes: "",
    },
  });

  const selectedReviewers = [
    watch("ketuaTimId"),
    watch("dalnisId"),
    watch("dalmutId"),
    watch("operatorId"),
  ].filter(Boolean);

  function onSubmit(values: DocumentMetadataInput) {
    if (!file) {
      setFileError("File dokumen wajib diupload.");
      return;
    }
    setFileError(undefined);

    const formData = new FormData();
    formData.set("nomorSuratTugas", values.nomorSuratTugas);
    formData.set("namaLaporan", values.namaLaporan);
    formData.set("ketuaTimId", values.ketuaTimId);
    formData.set("dalnisId", values.dalnisId);
    formData.set("dalmutId", values.dalmutId);
    formData.set("operatorId", values.operatorId);
    formData.set("uploadNotes", values.uploadNotes ?? "");
    formData.set("file", file);

    startTransition(async () => {
      const result = await createDocument(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Dokumen berhasil diupload.");
      router.push(`/documents/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 pb-24">
      <Card>
        <CardHeader>
          <CardTitle>Informasi Dokumen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nomorSuratTugas">Nomor Surat Tugas</Label>
            <Input
              id="nomorSuratTugas"
              placeholder="Contoh: ST-045/LP/2026 - RSUD Bakti Husada"
              aria-invalid={!!errors.nomorSuratTugas}
              aria-describedby={errors.nomorSuratTugas ? "nomorSuratTugas-error" : undefined}
              {...register("nomorSuratTugas")}
            />
            {errors.nomorSuratTugas ? (
              <p id="nomorSuratTugas-error" role="alert" className="text-sm text-destructive">
                {errors.nomorSuratTugas.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="namaLaporan">Nama Laporan</Label>
            <Input
              id="namaLaporan"
              aria-invalid={!!errors.namaLaporan}
              aria-describedby={errors.namaLaporan ? "namaLaporan-error" : undefined}
              {...register("namaLaporan")}
            />
            {errors.namaLaporan ? (
              <p id="namaLaporan-error" role="alert" className="text-sm text-destructive">
                {errors.namaLaporan.message}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tim Reviewer</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File Dokumen</CardTitle>
        </CardHeader>
        <CardContent>
          <FileDropzone file={file} onChange={setFile} error={fileError} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catatan (opsional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Catatan untuk reviewer (opsional)"
            rows={4}
            {...register("uploadNotes")}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between border-t border-border bg-card px-6 py-4 shadow-elevated">
        <Button
          type="button"
          variant="link"
          onClick={() => router.push("/dashboard")}
          disabled={isPending}
        >
          Batal
        </Button>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" disabled title="Segera hadir">
            Simpan sebagai Draft
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Upload & Submit
          </Button>
        </div>
      </div>
    </form>
  );
}
