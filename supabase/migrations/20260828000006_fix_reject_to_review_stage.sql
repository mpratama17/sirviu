-- Fix: reject_review left documents unreachable when the target stage was
-- itself a REVIEW stage (2 or 4), not an upload stage.
--
-- VALID_REJECT_TARGETS (lib/constants/stages.ts) allows stage 4 to reject
-- back to stage 2, and stage 6 to reject back to stage 2 or 4 — not just
-- back to the nearest KT upload stage (1/3/5). reject_review unconditionally
-- set status = 'revision_requested', which means "KT must upload a new
-- version before anything else can happen" (canUploadRevision gates on
-- stage.isUploadStage, canApprove gates on status = 'in_progress'). When the
-- target stage is 2 or 4, NEITHER holds: the document is stuck with no
-- actionable UI state for any role. Confirmed empirically against live data
-- (4 -> reject target 2 landed at (stage=2, status='revision_requested'),
-- both canApprove and canUploadRevision returned false for every user).
--
-- The correct semantics: rejecting to a review stage means "the reviewer at
-- that stage needs to look at this again" — there is no new version to
-- upload, so the document should go straight back to 'in_progress' so that
-- reviewer's Setujui/Kembalikan actions are immediately available. Rejecting
-- to an upload stage (1/3/5) still means "KT must upload first", so it keeps
-- 'revision_requested'.
create or replace function public.reject_review(
  p_document_id uuid,
  p_target_stage int,
  p_comment text
)
returns public.documents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.documents;
  v_version_id uuid;
  v_from_stage int;
  v_new_status text;
begin
  if v_actor is null then
    raise exception 'Harus login.';
  end if;
  if trim(coalesce(p_comment, '')) = '' then
    raise exception 'Komentar wajib diisi.';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'Dokumen tidak ditemukan.';
  end if;

  if v_doc.status <> 'in_progress' then
    raise exception 'Dokumen tidak dalam status in_progress.';
  end if;

  if v_doc.current_stage = 2 then
    if v_doc.dalnis_id <> v_actor then
      raise exception 'Hanya Pengendali Teknis dokumen ini yang boleh mengembalikan.';
    end if;
    if p_target_stage <> 1 then
      raise exception 'Dari stage 2 hanya bisa kembali ke stage 1.';
    end if;
  elsif v_doc.current_stage = 4 then
    if v_doc.dalmut_id <> v_actor then
      raise exception 'Hanya Pengendali Mutu dokumen ini yang boleh mengembalikan.';
    end if;
    if p_target_stage not in (1, 2, 3) then
      raise exception 'Dari stage 4 hanya bisa kembali ke stage 1, 2, atau 3.';
    end if;
  elsif v_doc.current_stage = 6 then
    if v_doc.operator_id <> v_actor then
      raise exception 'Hanya Operator dokumen ini yang boleh mengembalikan.';
    end if;
    if p_target_stage not in (1, 2, 3, 4, 5) then
      raise exception 'Dari stage 6 hanya bisa kembali ke stage 1-5.';
    end if;
  else
    raise exception 'Kembalikan untuk revisi hanya berlaku di stage 2, 4, atau 6.';
  end if;

  v_from_stage := v_doc.current_stage;

  select id into v_version_id
    from public.document_versions
    where document_id = p_document_id
    order by version_number desc
    limit 1;

  -- Target ke stage upload (1/3/5): KT harus upload versi baru dulu.
  -- Target ke stage reviu (2/4): reviewer di stage itu review ulang versi
  -- yang sama, tidak ada upload yang perlu terjadi -- langsung in_progress.
  if p_target_stage in (1, 3, 5) then
    v_new_status := 'revision_requested';
  else
    v_new_status := 'in_progress';
  end if;

  update public.documents
    set current_stage = p_target_stage,
        status = v_new_status,
        current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, target_stage_on_reject
  ) values (
    p_document_id, v_version_id, v_from_stage, p_target_stage, 'reject', v_actor, p_comment, p_target_stage
  );

  -- Reset approval: transitions yang masuk ke stage > target jadi tidak
  -- valid lagi (reviewer di situ harus review ulang). Strictly `>` (bukan
  -- `>=`) supaya baris pembuatan dokumen (from_stage=null, to_stage=1)
  -- TIDAK ikut ke-supersede saat target=1 — itu bukan approval, itu
  -- provenance dokumen. Brief §5.2/§6.3.
  update public.stage_transitions
    set is_superseded = true
    where document_id = p_document_id
      and to_stage > p_target_stage
      and action in ('approve', 'submit')
      and is_superseded = false;

  return v_doc;
end;
$$;

grant execute on function public.reject_review to authenticated;
