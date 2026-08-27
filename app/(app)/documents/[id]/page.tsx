import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { StageBadge } from "@/components/documents/stage-badge";
import { StatusBadge } from "@/components/documents/status-badge";
import { DaysInStage } from "@/components/documents/days-in-stage";
import { AssignmentCard, type AssignedUser } from "@/components/documents/assignment-card";
import { VersionCard } from "@/components/documents/version-card";
import { StageTimeline, type TimelineTransition } from "@/components/documents/stage-timeline";
import { CommentHistory } from "@/components/documents/comment-history";
import { ActionPanel } from "@/components/documents/action-panel";
import { daysSince } from "@/lib/utils/dates";
import { getCurrentStageAssigneeId } from "@/lib/utils/permissions";
import type { DocumentStatus, MinimalDocument, Role, Stage } from "@/lib/types/domain";

export default async function DocumentDetailPage({
  params,
}: PageProps<"/documents/[id]">) {
  const { id } = await params;
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

  const holderId = getCurrentStageAssigneeId(minimalDoc);
  const holderName = holderId ? (userMap.get(holderId)?.name ?? null) : null;

  const lastRejectTransition = [...transitions]
    .reverse()
    .find((t) => t.action === "reject" && !t.isSuperseded);
  const lastRejection =
    doc.status === "revision_requested" && lastRejectTransition && lastRejectTransition.comment
      ? { actorName: lastRejectTransition.actorName, comment: lastRejectTransition.comment }
      : null;

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

          <div className="sticky top-4">
            <ActionPanel
              doc={minimalDoc}
              currentUserId={currentUser.id}
              holderName={holderName}
              lastRejection={lastRejection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
