-- SIRVIU — 20260828000005_upload_revision_function
-- Milestone 4: KT upload versi baru saat status = revision_requested.
-- Sama pola dengan RPC lain (security definer, actor dari auth.uid(),
-- file sudah harus ter-upload ke storage dulu sebelum RPC ini dipanggil).

create function public.upload_revision(
  p_document_id uuid,
  p_file_path text,
  p_file_name text,
  p_file_size int,
  p_mime_type text,
  p_upload_notes text default null
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
begin
  if v_actor is null then
    raise exception 'Harus login.';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'Dokumen tidak ditemukan.';
  end if;

  if v_doc.status <> 'revision_requested' then
    raise exception 'Upload revisi hanya berlaku saat status revision_requested.';
  end if;
  if v_doc.current_stage not in (1, 3, 5) then
    raise exception 'Upload revisi hanya berlaku di stage 1, 3, atau 5.';
  end if;
  if v_doc.ketua_tim_id <> v_actor then
    raise exception 'Hanya Ketua Tim dokumen ini yang boleh upload revisi.';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version
    from public.document_versions
    where document_id = p_document_id;

  insert into public.document_versions (
    document_id, version_number, file_path, file_name, file_size, mime_type, uploaded_by, upload_notes
  ) values (
    p_document_id, v_next_version, p_file_path, p_file_name, p_file_size, p_mime_type, v_actor, p_upload_notes
  )
  returning id into v_version_id;

  -- Stage TIDAK berubah (masih di stage yang sama, siap di-submit lagi
  -- oleh KT) — jadi current_stage_started_at TIDAK di-reset, konsisten
  -- dengan format_fix (bukan stage transition, cuma versi baru). Brief §5.2.
  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment
  ) values (
    p_document_id, v_version_id, v_doc.current_stage, v_doc.current_stage, 'upload_revision', v_actor, p_upload_notes
  );

  update public.documents
    set status = 'in_progress'
    where id = p_document_id
    returning * into v_doc;

  return v_doc;
end;
$$;

grant execute on function public.upload_revision to authenticated;
