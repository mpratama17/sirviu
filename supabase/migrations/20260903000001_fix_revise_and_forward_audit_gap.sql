-- Fix: reviewer_revise_and_forward mencatat stage_transitions sebagai
-- self-loop (mis. 2 -> 2) padahal documents.current_stage langsung
-- di-advance ke v_next_stage (mis. 3) di statement berikutnya. Akibatnya
-- baris audit trail yang menjelaskan lompatan 2 -> 3 tidak pernah tercatat
-- — stage_transitions jadi "bolong" tepat di titik yang paling perlu utuh
-- (prinsip append-only audit trail, lihat AGENTS.md §6.6).
--
-- Ditemukan lewat testing manual user (2026-09-03) — dokumen nyata
-- menunjukkan gap: baris "2 -> 2" (revise_and_forward) langsung disusul
-- baris "3 -> 4" (approve berikutnya) tanpa penjelasan bagaimana dokumen
-- pindah dari stage 2 ke 3.
--
-- Efek samping yang ikut kebenerin: predicate supersede di reject_review
-- (`to_stage > p_target_stage and action in ('approve','submit',
-- 'revise_and_forward')`) memakai to_stage baris ini juga — dengan
-- to_stage yang salah (sama dengan from_stage), baris revise_and_forward
-- bisa lolos tidak ke-supersede saat harusnya kena (mis. reject berikutnya
-- balik persis ke stage yang jadi to_stage asli). Fix ini juga menutup itu.
--
-- Fix: satu baris tetap cukup (bukan 2 baris ala format_fix_and_finalize)
-- karena revise_and_forward memang satu aksi atomik "revisi + forward" —
-- catat apa adanya: from_stage = stage lama, to_stage = stage baru.

create or replace function public.reviewer_revise_and_forward(
  p_document_id uuid,
  p_file_path text,
  p_file_name text,
  p_file_size int,
  p_mime_type text,
  p_comment text default null
)
returns public.documents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.documents;
  v_next_version int;
  v_version_id uuid;
  v_next_stage int;
  v_override boolean := false;
begin
  if v_actor is null then raise exception 'Harus login.'; end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;

  if v_doc.status <> 'in_progress' then
    raise exception 'Dokumen tidak dalam status in_progress.';
  end if;

  if v_doc.current_stage = 2 then
    if v_doc.dalnis_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Pengendali Teknis dokumen ini yang boleh revisi.';
      end if;
      v_override := true;
    end if;
    v_next_stage := 3;
  elsif v_doc.current_stage = 3 then
    if v_doc.dalmut_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Irban (Pengendali Mutu) dokumen ini yang boleh revisi.';
      end if;
      v_override := true;
    end if;
    v_next_stage := 4;
  else
    raise exception 'Revisi reviewer hanya berlaku di stage 2 atau 3.';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version
    from public.document_versions
    where document_id = p_document_id;

  insert into public.document_versions (
    document_id, version_number, file_path, file_name, file_size, mime_type, uploaded_by, upload_notes
  ) values (
    p_document_id, v_next_version, p_file_path, p_file_name, p_file_size, p_mime_type, v_actor, p_comment
  )
  returning id into v_version_id;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override
  ) values (
    p_document_id, v_version_id, v_doc.current_stage, v_next_stage, 'revise_and_forward', v_actor, p_comment, v_override
  );

  update public.documents
    set current_stage = v_next_stage,
        current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  perform public._notify_stage_holder(v_doc);
  return v_doc;
end;
$$;

comment on function public.reviewer_revise_and_forward is
  'Reviewer (Dalnis/Dalmut) upload revisi sendiri lalu forward ke stage berikutnya, satu baris stage_transitions (from_stage lama -> to_stage baru) — bukan self-loop.';
