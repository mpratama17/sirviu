import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { StageBadge } from "@/components/documents/stage-badge";
import { StatusBadge } from "@/components/documents/status-badge";
import { DaysInStage } from "@/components/documents/days-in-stage";
import { AssignmentCard, type AssignedUser } from "@/components/documents/assignment-card";
import { VersionCard } from "@/components/documents/version-card";
import { VersionSelector } from "@/components/documents/version-selector";
import { PdfViewerLoader } from "@/components/documents/pdf-viewer-loader";
import { StageTimeline, type TimelineTransition } from "@/components/documents/stage-timeline";
import { CommentHistory } from "@/components/documents/comment-history";
import { ActionPanel } from "@/components/documents/action-panel";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { AdminDeleteButton } from "@/components/documents/admin-delete-button";
import { EditDocumentModal } from "@/components/documents/edit-document-modal";
import type { SelectableUser } from "@/components/documents/user-combobox";
import { daysSince } from "@/lib/utils/dates";
import {
  canAdminDelete,
  canHardDelete,
  getCurrentStageAssigneeId,
} from "@/lib/utils/permissions";
import type {
  DocumentStatus,
  MinimalDocument,
  Role,
  Stage,
  TransitionAction,
} from "@/lib/types/domain";

export default async function DocumentDetailPage({
  params,
  searchParams,
}: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!doc || !currentUser) {
    // RLS sudah menyaring — bisa karena memang tidak ada, atau ada tapi
    // user tidak berhak lihat. Tidak dibedakan ke user (brief §6.5).
    notFound();
  }

  const [{ data: versions }, { data: transitionsRaw }] = await Promise.all([
    supabase
      .from("document_versions")
      .select("*")
      .eq("document_id", id)
      .order("version_number", { ascending: false }),
    supabase
      .from("stage_transitions")
      .select("*")
      .eq("document_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const versionNumberById = new Map(
    (versions ?? []).map((v) => [v.id, v.version_number]),
  );

  const relevantUserIds = new Set<string>([
    doc.ketua_tim_id,
    doc.dalnis_id,
    doc.dalmut_id,
    doc.operator_id,
    doc.submitter_id,
    ...(transitionsRaw ?? []).map((t) => t.actor_id),
  ]);

  const { data: relevantUsers } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", Array.from(relevantUserIds));

  const userMap = new Map((relevantUsers ?? []).map((u) => [u.id, u]));

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

  const transitions: TimelineTransition[] = (transitionsRaw ?? []).map((t) => ({
    id: t.id,
    fromStage: t.from_stage,
    toStage: t.to_stage,
    action: t.action,
    actorName: userMap.get(t.actor_id)?.name ?? "—",
    comment: t.comment,
    versionNumber: t.version_id ? (versionNumberById.get(t.version_id) ?? null) : null,
    isSuperseded: t.is_superseded,
    createdAt: t.created_at,
  }));

  const minimalDoc: MinimalDocument = {
    id: doc.id,
    submitterId: doc.submitter_id,
    ketuaTimId: doc.ketua_tim_id,
    dalnisId: doc.dalnis_id,
    dalmutId: doc.dalmut_id,
    operatorId: doc.operator_id,
    currentStage: doc.current_stage as Stage,
    status: doc.status as DocumentStatus,
  };

  const canDelete = canHardDelete(
    minimalDoc,
    currentUser.id,
    (transitionsRaw ?? []).map((t) => ({ action: t.action as TransitionAction })),
  );

  const isAdmin = currentUser.roles.includes("admin");
  const canDeleteAsAdmin = canAdminDelete(currentUser.roles as Role[]);

  const holderId = getCurrentStageAssigneeId(minimalDoc);
  const holderName = holderId ? (userMap.get(holderId)?.name ?? null) : null;
  const isOverride = isAdmin && holderId !== null && holderId !== currentUser.id;

  // Daftar user aktif untuk combobox reassign di modal edit — cuma di-fetch
  // kalau admin (satu-satunya yang bisa lihat modalnya), biar tidak nambah
  // query buat semua orang lain.
  let selectableUsers: SelectableUser[] = [];
  if (isAdmin) {
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, name, email, roles, is_active")
      .order("name");
    selectableUsers = (allUsers ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roles: u.roles,
      isActive: u.is_active,
    }));
  }

  const lastRejectTransition = [...transitions]
    .reverse()
    .find((t) => t.action === "reject" && !t.isSuperseded);
  const lastRejection =
    doc.status === "revision_requested" && lastRejectTransition && lastRejectTransition.comment
      ? { actorName: lastRejectTransition.actorName, comment: lastRejectTransition.comment }
      : null;

  const allVersions = versions ?? [];
  const latestVersionNumber = allVersions[0]?.version_number ?? 1;
  const requestedVersion = typeof query.v === "string" ? Number(query.v) : null;
  const selectedVersion =
    allVersions.find((v) => v.version_number === requestedVersion) ?? allVersions[0];

  let previewUrl: string | null = null;
  if (selectedVersion?.mime_type === "application/pdf") {
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(selectedVersion.file_path, 300);
    previewUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <p className="text-sm text-text-muted tabular-nums">{doc.nomor_surat_tugas}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {doc.nama_laporan}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Dokumen</h2>
            <div className="flex items-center gap-2">
              {selectedVersion ? (
                <VersionSelector
                  versionNumbers={allVersions.map((v) => v.version_number)}
                  latestVersionNumber={latestVersionNumber}
                  selected={selectedVersion.version_number}
                />
              ) : null}
              {selectedVersion ? (
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <a
                      href={`/documents/${doc.id}/download?v=${selectedVersion.version_number}`}
                    />
                  }
                >
                  <Download className="size-4" aria-hidden="true" />
                  Download
                </Button>
              ) : null}
            </div>
          </div>

          {selectedVersion?.mime_type === "application/pdf" && previewUrl ? (
            <PdfViewerLoader fileUrl={previewUrl} />
          ) : selectedVersion ? (
            <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
              File .docx tidak bisa dipratinjau. Silakan download.
            </p>
          ) : null}

          <h2 className="mt-3 text-lg font-semibold text-foreground">Riwayat Versi</h2>
          {allVersions.map((v) => (
            <VersionCard
              key={v.id}
              documentId={doc.id}
              versionNumber={v.version_number}
              isLatest={v.version_number === latestVersionNumber}
              fileName={v.file_name}
              fileSize={v.file_size}
              mimeType={v.mime_type}
              uploadedByName={userMap.get(v.uploaded_by)?.name ?? "—"}
              uploadedAt={v.uploaded_at}
              uploadNotes={v.upload_notes}
            />
          ))}

          <h2 className="mt-3 text-lg font-semibold text-foreground">Timeline</h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <StageTimeline
              currentStage={doc.current_stage as Stage}
              status={doc.status}
              transitions={transitions}
            />
          </div>

          <CommentHistory transitions={transitions} />
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

          <div className="sticky top-4 flex flex-col gap-3">
            <ActionPanel
              doc={minimalDoc}
              currentUserId={currentUser.id}
              holderName={holderName}
              lastRejection={lastRejection}
              isAdmin={isAdmin}
              isOverride={isOverride}
            />
            {isAdmin ? (
              <EditDocumentModal
                documentId={doc.id}
                users={selectableUsers}
                initial={{
                  nomorSuratTugas: doc.nomor_surat_tugas,
                  namaLaporan: doc.nama_laporan,
                  ketuaTimId: doc.ketua_tim_id,
                  dalnisId: doc.dalnis_id,
                  dalmutId: doc.dalmut_id,
                  operatorId: doc.operator_id,
                }}
              />
            ) : null}
            {canDeleteAsAdmin ? (
              <AdminDeleteButton documentId={doc.id} />
            ) : canDelete ? (
              <DeleteDocumentButton documentId={doc.id} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
