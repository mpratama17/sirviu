-- SIRVIU — 20260828000003_document_write_functions
-- RPC untuk mutasi dokumen yang butuh actor tepercaya (dari auth.uid(),
-- bukan parameter yang bisa dipalsukan caller) dan menulis ke tabel
-- append-only (document_versions, stage_transitions) yang sengaja tidak
-- punya INSERT policy untuk `authenticated`. Lihat AGENTS.md bagian
-- "State-machine mutations" untuk kenapa ini bukan service role.

-- ============================================================
-- create_document — Milestone 2: upload dokumen baru
-- ============================================================
-- Membuat documents + document_versions (v1) + stage_transitions
-- (initial entry, from_stage=null → to_stage=1) dalam satu transaksi.
-- File sudah harus ter-upload ke storage SEBELUM RPC ini dipanggil
-- (storage tidak transactional dengan Postgres) — caller (server action)
-- generate `p_document_id` dengan `crypto.randomUUID()` lalu upload ke
-- path `{p_document_id}/v1/{filename}` dulu, baru panggil ini.
create function public.create_document(
  p_document_id uuid,
  p_nomor_surat_tugas text,
  p_nama_laporan text,
  p_ketua_tim_id uuid,
  p_dalnis_id uuid,
  p_dalmut_id uuid,
  p_operator_id uuid,
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
  v_version_id uuid;
begin
  if v_actor is null then
    raise exception 'Harus login untuk membuat dokumen.';
  end if;

  -- Reimplementasi guard yang sama dengan RLS policy documents_insert
  -- (brief §7) — RPC ini security definer jadi tidak otomatis kena RLS,
  -- validasi permission harus eksplisit di sini.
  if not exists (
    select 1 from public.users
    where id = v_actor and 'ketua_tim' = any(roles) and is_active
  ) then
    raise exception 'Hanya Ketua Tim aktif yang boleh membuat dokumen.';
  end if;

  insert into public.documents (
    id, nomor_surat_tugas, nama_laporan, submitter_id,
    ketua_tim_id, dalnis_id, dalmut_id, operator_id
  ) values (
    p_document_id, p_nomor_surat_tugas, p_nama_laporan, v_actor,
    p_ketua_tim_id, p_dalnis_id, p_dalmut_id, p_operator_id
  )
  returning * into v_doc;

  insert into public.document_versions (
    document_id, version_number, file_path, file_name, file_size,
    mime_type, uploaded_by, upload_notes
  ) values (
    v_doc.id, 1, p_file_path, p_file_name, p_file_size,
    p_mime_type, v_actor, p_upload_notes
  )
  returning id into v_version_id;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment
  ) values (
    v_doc.id, v_version_id, null, 1, 'submit', v_actor, p_upload_notes
  );

  return v_doc;
end;
$$;

comment on function public.create_document is
  'Milestone 2: insert documents+document_versions(v1)+stage_transitions(initial) atomically. actor_id derived from auth.uid(), tidak dari parameter.';

-- Fungsi ini yang jadi trust boundary (bukan RLS tabelnya) — grant ke
-- authenticated, permission check ada di dalam function body.
grant execute on function public.create_document to authenticated;
