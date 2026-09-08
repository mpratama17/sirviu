"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
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
import { ROLE_LABELS } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";
import {
  documentMetadataSchema,
  type DocumentMetadataInput,
} from "@/lib/validators/documents";

/** Badge lingkaran bernomor di samping judul section — DESIGN_BRIEF mockup terbaru. */
function SectionTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2.5">
      <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary tabular-nums">
        {n}
      </span>
      {children}
    </CardTitle>
  );
}

/** Form ini 1 halaman panjang berisi 4 section — bukan wizard multi-halaman,
 * jadi breadcrumb (navigasi antar-halaman) tidak relevan di sini. Yang
 * dibutuhkan adalah user tahu "lagi di section mana" pas scroll: nav
 * sticky ini highlight section yang sedang kelihatan (scrollspy) dan
 * klik = lompat ke section itu. */
const FORM_SECTIONS = [
  { id: "section-info", label: "Info Dokumen" },
  { id: "section-tim", label: "Tim Reviewer" },
  { id: "section-file", label: "File" },
  { id: "section-catatan", label: "Catatan" },
] as const;
const FORM_SECTION_IDS = FORM_SECTIONS.map((s) => s.id);

/** Scrollspy minimal: section aktif = yang pertama (urutan dokumen) dari
 * yang sedang intersecting. `rootMargin` bikin garis deteksi tepat di
 * bawah nav sticky, bukan di tengah viewport, biar transisi antar-section
 * terasa pas dengan yang benar-benar kelihatan di layar. */
function useActiveSection(ids: readonly string[]): string {
  const [active, setActive] = useState<string>(ids[0]);

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const visibility = new Map<string, boolean>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => visibility.set(entry.target.id, entry.isIntersecting));
        const firstVisible = ids.find((id) => visibility.get(id));
        if (firstVisible) setActive(firstVisible);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

function SectionNav({ activeId }: { activeId: string }) {
  return (
    <nav
      aria-label="Bagian formulir"
      className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
    >
      {FORM_SECTIONS.map((section, i) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={activeId === section.id ? "location" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            activeId === section.id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums",
              activeId === section.id ? "bg-primary text-primary-foreground" : "bg-secondary",
            )}
          >
            {i + 1}
          </span>
          {section.label}
        </a>
      ))}
    </nav>
  );
}

export function DocumentForm({
  users,
  currentUserId,
  currentUserName,
}: {
  /** Anggota tim Anda saja (dalnis/dalmut/operator) — isolasi tim, lihat AGENTS.md. */
  users: readonly SelectableUser[];
  currentUserId: string;
  currentUserName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const activeSection = useActiveSection(FORM_SECTION_IDS);

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
      <SectionNav activeId={activeSection} />
      <Card id="section-info" className="scroll-mt-20">
        <CardHeader>
          <SectionTitle n={1}>Informasi Dokumen</SectionTitle>
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

      <Card id="section-tim" className="scroll-mt-20">
        <CardHeader>
          <SectionTitle n={2}>Tim Reviewer</SectionTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Ketua Tim</Label>
            <Input value={currentUserName} disabled readOnly />
            <input type="hidden" {...register("ketuaTimId")} />
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
                  placeholder={
                    users.some((u) => u.roles.includes("dalnis"))
                      ? undefined
                      : "Belum ada anggota — tambahkan di Tim Saya"
                  }
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
            <Label>{ROLE_LABELS.dalmut}</Label>
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
                  placeholder={
                    users.some((u) => u.roles.includes("dalmut"))
                      ? undefined
                      : "Belum ada anggota — tambahkan di Tim Saya"
                  }
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
                  placeholder={
                    users.some((u) => u.roles.includes("operator"))
                      ? undefined
                      : "Belum ada anggota — tambahkan di Tim Saya"
                  }
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

      <Card id="section-file" className="scroll-mt-20">
        <CardHeader>
          <SectionTitle n={3}>File Dokumen</SectionTitle>
        </CardHeader>
        <CardContent>
          <FileDropzone file={file} onChange={setFile} error={fileError} />
        </CardContent>
      </Card>

      <Card id="section-catatan" className="scroll-mt-20">
        <CardHeader>
          <SectionTitle n={4}>Catatan (opsional)</SectionTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Catatan untuk reviewer (opsional)"
            className="min-h-48 max-h-[45vh]"
            {...register("uploadNotes")}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-4 shadow-elevated sm:-mx-6 sm:px-6">
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
