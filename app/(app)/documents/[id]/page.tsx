import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StageBadge } from "@/components/documents/stage-badge";
import { StatusBadge } from "@/components/documents/status-badge";
import { DaysInStage } from "@/components/documents/days-in-stage";
import { AssignmentCard, type AssignedUser } from "@/components/documents/assignment-card";
import { VersionCard } from "@/components/documents/version-card";
import { daysSince } from "@/lib/utils/dates";
import type { DocumentStatus, Role, Stage } from "@/lib/types/domain";

export default async function DocumentDetailPage({
  params,
}: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    // RLS sudah menyaring — bisa karena memang tidak ada, atau ada tapi
    // user tidak berhak lihat. Tidak dibedakan ke user (brief §6.5).
    notFound();
  }

  const assignedIds = [
    doc.ketua_tim_id,
    doc.dalnis_id,
    doc.dalmut_id,
    doc.operator_id,
  ];

  const [{ data: assignedUsers }, { data: versions }] = await Promise.all([
    supabase.from("users").select("id, name, email").in("id", assignedIds),
    supabase
      .from("document_versions")
      .select("*")
      .eq("document_id", id)
      .order("version_number", { ascending: false }),
  ]);

  const userMap = new Map((assignedUsers ?? []).map((u) => [u.id, u]));
  const team: AssignedUser[] = (
    [
      ["ketua_tim", doc.ketua_tim_id],
      ["dalnis", doc.dalnis_id],
      ["dalmut", doc.dalmut_id],
      ["operator", doc.operator_id],
    ] as [Role, string][]
  ).map(([role, userId]) => {
    const u = userMap.get(userId);
    return { role, name: u?.name ?? "—", email: u?.email ?? "" };
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm text-text-muted tabular-nums">{doc.nomor_surat_tugas}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {doc.nama_laporan}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Versi Dokumen</h2>
          {(versions ?? []).map((v) => (
            <VersionCard
              key={v.id}
              documentId={doc.id}
              versionNumber={v.version_number}
              isLatest={v.version_number === versions?.[0]?.version_number}
              fileName={v.file_name}
              fileSize={v.file_size}
              mimeType={v.mime_type}
              uploadedByName={userMap.get(v.uploaded_by)?.name ?? "—"}
              uploadedAt={v.uploaded_at}
              uploadNotes={v.upload_notes}
            />
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={doc.status as DocumentStatus} />
              <StageBadge stage={doc.current_stage as Stage} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              <DaysInStage days={daysSince(doc.current_stage_started_at)} /> di
              stage ini
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Tim Ditugaskan</h3>
            <AssignmentCard team={team} />
          </div>

          <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
            Timeline tahap & aksi reviu akan tersedia di Milestone 3.
          </div>
        </div>
      </div>
    </div>
  );
}
