-- SIRVIU — 20260828000007_admin_full_access
--
-- Deviation from brief §7 (brief scopes admin to "mengelola user dan
-- mengakses audit trail" + full document visibility only) — explicit user
-- request: admin harus bisa melakukan SEMUA aksi (submit/approve/reject/
-- upload/finalize/format-fix/delete/edit metadata) di dokumen manapun,
-- bukan cuma dokumen yang mereka assigned ke. Lihat AGENTS.md.
--
-- Design:
-- 1. Setiap RPC state-machine (...000003/4/5) di-CREATE OR REPLACE supaya
--    ownership check ("hanya X dokumen ini yang boleh...") juga meloloskan
--    admin — TAPI stage/status check (state machine itu sendiri) TIDAK
--    dilonggarkan. Admin bertindak "sebagai pemegang stage saat ini", bukan
--    di luar aturan alur.
-- 2. `actor_id` tetap selalu dari `auth.uid()` (tidak pernah dipalsukan) —
--    kalau admin approve dokumen yang bukan tanggung jawabnya, transition
--    row mencatat admin sebagai actor, apa adanya. `is_admin_override`
--    (kolom baru) menandai baris itu supaya /admin/audit bisa membedakan
--    "pemegang stage asli bertindak" vs "admin override" — tanpa kolom ini
--    override tidak bisa dibedakan dari aksi normal di audit trail, yang
--    justru menghilangkan gunanya audit trail di sistem yang sekarang
--    punya admin-bisa-apa-saja.
-- 3. Hard delete (pilihan eksplisit user, menimpang prinsip append-only)
--    dan edit metadata dokumen adalah kemampuan BARU (brief tidak
--    menyebutnya sama sekali) — masing-masing lewat RPC admin-only
--    tersendiri, dengan log snapshot yang tetap hidup SETELAH dokumennya
--    sendiri dihapus/diedit, supaya ada jejak minimal yang selamat dari
--    hard delete.

-- ============================================================
-- 0. Kolom baru: tandai baris stage_transitions yang berasal dari admin
--    bertindak di luar assignment aslinya.
-- ============================================================
alter table public.stage_transitions
  add column is_admin_override boolean not null default false;

comment on column public.stage_transitions.is_admin_override is
  'true kalau actor_id BUKAN pemegang assignment normal untuk aksi ini (mis. admin approve dokumen yang dalnis_id-nya orang lain). actor_id tetap jujur dari auth.uid() — kolom ini cuma penanda, bukan pemalsuan identitas.';

-- ============================================================
-- 1. submit_document — tambah admin bypass
-- ============================================================
create or replace function public.submit_document(
  p_document_id uuid,
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
  v_version_id uuid;
  v_next_stage int;
  v_override boolean := false;
begin
  if v_actor is null then
    raise exception 'Harus login.';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'Dokumen tidak ditemukan.';
  end if;

  if v_doc.status <> 'in_progress' then
    raise exception 'Dokumen tidak dalam status in_progress.';
  end if;
  if v_doc.current_stage not in (1, 3, 5) then
    raise exception 'Submit hanya berlaku di stage 1, 3, atau 5.';
  end if;
  if v_doc.ketua_tim_id <> v_actor then
    if not public.is_admin(v_actor) then
      raise exception 'Hanya Ketua Tim dokumen ini yang boleh submit.';
    end if;
    v_override := true;
  end if;

  v_next_stage := v_doc.current_stage + 1;

  select id into v_version_id
    from public.document_versions
    where document_id = p_document_id
    order by version_number desc
    limit 1;

  update public.documents
    set current_stage = v_next_stage,
        current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override
  ) values (
    p_document_id, v_version_id, v_doc.current_stage - 1, v_next_stage, 'submit', v_actor, p_comment, v_override
  );

  return v_doc;
end;
$$;

grant execute on function public.submit_document to authenticated;

-- ============================================================
-- 2. approve_review — tambah admin bypass
-- ============================================================
create or replace function public.approve_review(
  p_document_id uuid,
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
  v_version_id uuid;
  v_next_stage int;
  v_override boolean := false;
begin
  if v_actor is null then
    raise exception 'Harus login.';
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
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Pengendali Teknis dokumen ini yang boleh approve.';
      end if;
      v_override := true;
    end if;
  elsif v_doc.current_stage = 4 then
    if v_doc.dalmut_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Pengendali Mutu dokumen ini yang boleh approve.';
      end if;
      v_override := true;
    end if;
  else
    raise exception 'Approve hanya berlaku di stage 2 atau 4.';
  end if;

  v_next_stage := v_doc.current_stage + 1;

  select id into v_version_id
    from public.document_versions
    where document_id = p_document_id
    order by version_number desc
    limit 1;

  update public.documents
    set current_stage = v_next_stage,
        current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override
  ) values (
    p_document_id, v_version_id, v_doc.current_stage - 1, v_next_stage, 'approve', v_actor, p_comment, v_override
  );

  return v_doc;
end;
$$;

grant execute on function public.approve_review to authenticated;

-- ============================================================
-- 3. reject_review — tambah admin bypass (di atas fix ...000006)
-- ============================================================
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
  v_override boolean := false;
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
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Pengendali Teknis dokumen ini yang boleh mengembalikan.';
      end if;
      v_override := true;
    end if;
    if p_target_stage <> 1 then
      raise exception 'Dari stage 2 hanya bisa kembali ke stage 1.';
    end if;
  elsif v_doc.current_stage = 4 then
    if v_doc.dalmut_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Pengendali Mutu dokumen ini yang boleh mengembalikan.';
      end if;
      v_override := true;
    end if;
    if p_target_stage not in (1, 2, 3) then
      raise exception 'Dari stage 4 hanya bisa kembali ke stage 1, 2, atau 3.';
    end if;
  elsif v_doc.current_stage = 6 then
    if v_doc.operator_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Operator dokumen ini yang boleh mengembalikan.';
      end if;
      v_override := true;
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
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, target_stage_on_reject, is_admin_override
  ) values (
    p_document_id, v_version_id, v_from_stage, p_target_stage, 'reject', v_actor, p_comment, p_target_stage, v_override
  );

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

-- ============================================================
-- 4. finalize_document — tambah admin bypass
-- ============================================================
create or replace function public.finalize_document(
  p_document_id uuid,
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
  v_version_id uuid;
  v_override boolean := false;
begin
  if v_actor is null then
    raise exception 'Harus login.';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'Dokumen tidak ditemukan.';
  end if;

  if v_doc.status <> 'in_progress' then
    raise exception 'Dokumen tidak dalam status in_progress.';
  end if;
  if v_doc.current_stage <> 6 then
    raise exception 'Finalize hanya berlaku di stage 6.';
  end if;
  if v_doc.operator_id <> v_actor then
    if not public.is_admin(v_actor) then
      raise exception 'Hanya Operator dokumen ini yang boleh finalize.';
    end if;
    v_override := true;
  end if;

  select id into v_version_id
    from public.document_versions
    where document_id = p_document_id
    order by version_number desc
    limit 1;

  update public.documents
    set current_stage = 7,
        status = 'finalized',
        finalized_at = now(),
        current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override
  ) values (
    p_document_id, v_version_id, 6, 7, 'finalize', v_actor, p_comment, v_override
  );

  return v_doc;
end;
$$;

grant execute on function public.finalize_document to authenticated;

-- ============================================================
-- 5. format_fix_and_finalize — tambah admin bypass
-- ============================================================
create or replace function public.format_fix_and_finalize(
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
  v_override boolean := false;
begin
  if v_actor is null then
    raise exception 'Harus login.';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'Dokumen tidak ditemukan.';
  end if;

  if v_doc.status <> 'in_progress' then
    raise exception 'Dokumen tidak dalam status in_progress.';
  end if;
  if v_doc.current_stage <> 6 then
    raise exception 'Format fix hanya berlaku di stage 6.';
  end if;
  if v_doc.operator_id <> v_actor then
    if not public.is_admin(v_actor) then
      raise exception 'Hanya Operator dokumen ini yang boleh format fix.';
    end if;
    v_override := true;
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
    p_document_id, v_version_id, 6, 6, 'format_fix', v_actor, p_comment, v_override
  );

  update public.documents
    set current_stage = 7,
        status = 'finalized',
        finalized_at = now(),
        current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override
  ) values (
    p_document_id, v_version_id, 6, 7, 'finalize', v_actor, p_comment, v_override
  );

  return v_doc;
end;
$$;

grant execute on function public.format_fix_and_finalize to authenticated;

-- ============================================================
-- 6. upload_revision — tambah admin bypass
-- ============================================================
create or replace function public.upload_revision(
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
  v_override boolean := false;
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
    if not public.is_admin(v_actor) then
      raise exception 'Hanya Ketua Tim dokumen ini yang boleh upload revisi.';
    end if;
    v_override := true;
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

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override
  ) values (
    p_document_id, v_version_id, v_doc.current_stage, v_doc.current_stage, 'upload_revision', v_actor, p_upload_notes, v_override
  );

  update public.documents
    set status = 'in_progress'
    where id = p_document_id
    returning * into v_doc;

  return v_doc;
end;
$$;

grant execute on function public.upload_revision to authenticated;

-- ============================================================
-- 7. create_document — admin (tanpa role ketua_tim) juga boleh membuat
--    dokumen atas nama tim manapun. submitter_id tetap v_actor (jujur —
--    ini bukan "override" identitas, admin memang yang membuat baris ini).
-- ============================================================
create or replace function public.create_document(
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

  if not exists (
    select 1 from public.users
    where id = v_actor and 'ketua_tim' = any(roles) and is_active
  ) and not public.is_admin(v_actor) then
    raise exception 'Hanya Ketua Tim aktif (atau admin) yang boleh membuat dokumen.';
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

grant execute on function public.create_document to authenticated;

-- ============================================================
-- 8. Edit metadata dokumen (admin-only, kemampuan baru di luar brief).
--    Bisa dipakai kapan saja terlepas dari stage/status — perbaikan typo
--    nomor surat tugas atau reassign reviewer yang salah/cuti, tidak
--    melalui alur reviu jadi TIDAK menulis ke stage_transitions (itu
--    khusus event alur). Dicatat terpisah di document_edit_log supaya
--    tetap ada jejak, tanpa mengotori semantik timeline stage.
-- ============================================================
create table public.document_edit_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  edited_by uuid not null references public.users(id),
  edited_at timestamptz not null default now(),
  field_changes jsonb not null,
  reason text
);

create index idx_document_edit_log_doc on public.document_edit_log(document_id, edited_at desc);

comment on table public.document_edit_log is
  'Log admin mengedit metadata dokumen (nomor surat tugas/nama laporan/reassign tim) di luar alur reviu normal. Terpisah dari stage_transitions karena bukan event alur.';

alter table public.document_edit_log enable row level security;

create policy document_edit_log_select on public.document_edit_log
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- INSERT hanya lewat RPC admin_update_document_metadata (security definer).

create function public.admin_update_document_metadata(
  p_document_id uuid,
  p_nomor_surat_tugas text,
  p_nama_laporan text,
  p_ketua_tim_id uuid,
  p_dalnis_id uuid,
  p_dalmut_id uuid,
  p_operator_id uuid,
  p_reason text default null
)
returns public.documents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_before public.documents;
  v_after public.documents;
  v_changes jsonb := '{}'::jsonb;
begin
  if v_actor is null or not public.is_admin(v_actor) then
    raise exception 'Hanya admin yang boleh mengedit metadata dokumen.';
  end if;

  select * into v_before from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'Dokumen tidak ditemukan.';
  end if;

  if trim(coalesce(p_nomor_surat_tugas, '')) = '' then
    raise exception 'Nomor surat tugas wajib diisi.';
  end if;
  if trim(coalesce(p_nama_laporan, '')) = '' then
    raise exception 'Nama laporan wajib diisi.';
  end if;

  update public.documents
    set nomor_surat_tugas = p_nomor_surat_tugas,
        nama_laporan = p_nama_laporan,
        ketua_tim_id = p_ketua_tim_id,
        dalnis_id = p_dalnis_id,
        dalmut_id = p_dalmut_id,
        operator_id = p_operator_id
    where id = p_document_id
    returning * into v_after;

  if v_before.nomor_surat_tugas is distinct from v_after.nomor_surat_tugas then
    v_changes := v_changes || jsonb_build_object('nomor_surat_tugas',
      jsonb_build_object('before', v_before.nomor_surat_tugas, 'after', v_after.nomor_surat_tugas));
  end if;
  if v_before.nama_laporan is distinct from v_after.nama_laporan then
    v_changes := v_changes || jsonb_build_object('nama_laporan',
      jsonb_build_object('before', v_before.nama_laporan, 'after', v_after.nama_laporan));
  end if;
  if v_before.ketua_tim_id is distinct from v_after.ketua_tim_id then
    v_changes := v_changes || jsonb_build_object('ketua_tim_id',
      jsonb_build_object('before', v_before.ketua_tim_id, 'after', v_after.ketua_tim_id));
  end if;
  if v_before.dalnis_id is distinct from v_after.dalnis_id then
    v_changes := v_changes || jsonb_build_object('dalnis_id',
      jsonb_build_object('before', v_before.dalnis_id, 'after', v_after.dalnis_id));
  end if;
  if v_before.dalmut_id is distinct from v_after.dalmut_id then
    v_changes := v_changes || jsonb_build_object('dalmut_id',
      jsonb_build_object('before', v_before.dalmut_id, 'after', v_after.dalmut_id));
  end if;
  if v_before.operator_id is distinct from v_after.operator_id then
    v_changes := v_changes || jsonb_build_object('operator_id',
      jsonb_build_object('before', v_before.operator_id, 'after', v_after.operator_id));
  end if;

  if v_changes <> '{}'::jsonb then
    insert into public.document_edit_log (document_id, edited_by, field_changes, reason)
    values (p_document_id, v_actor, v_changes, p_reason);
  end if;

  return v_after;
end;
$$;

grant execute on function public.admin_update_document_metadata to authenticated;

-- ============================================================
-- 9. Hard delete dokumen oleh admin (pilihan eksplisit user, dikonfirmasi
--    menimpang prinsip append-only stage_transitions). Baris documents
--    dan seluruh document_versions/stage_transitions-nya BENAR-BENAR
--    dihapus (on delete cascade, migration ...000001). Snapshot ringkas
--    disimpan permanen di deleted_documents_log (tabel terpisah, TIDAK
--    ikut cascade) supaya minimal ada jejak bahwa penghapusan terjadi,
--    oleh siapa, dan kenapa — satu-satunya hal yang selamat dari hard
--    delete ini.
--
--    File di storage TIDAK bisa dihapus dari sini (Postgres RPC tidak
--    bisa memanggil storage API) — function ini return array file_path
--    supaya caller (server action, service role) yang membersihkannya.
-- ============================================================
create table public.deleted_documents_log (
  id uuid primary key default gen_random_uuid(),
  original_document_id uuid not null,
  nomor_surat_tugas text not null,
  nama_laporan text not null,
  submitter_id uuid,
  ketua_tim_id uuid,
  dalnis_id uuid,
  dalmut_id uuid,
  operator_id uuid,
  current_stage int not null,
  status text not null,
  versions_snapshot jsonb not null,
  transitions_snapshot jsonb not null,
  deleted_by uuid not null references public.users(id),
  deleted_at timestamptz not null default now(),
  reason text not null
);

comment on table public.deleted_documents_log is
  'Satu-satunya jejak yang selamat dari admin_delete_document (hard delete) — dokumen aslinya, versi, dan stage_transitions-nya sungguh-sungguh terhapus (cascade). Tabel ini sengaja TIDAK reference public.documents supaya tidak ikut cascade.';

alter table public.deleted_documents_log enable row level security;

create policy deleted_documents_log_select on public.deleted_documents_log
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- INSERT hanya lewat RPC admin_delete_document (security definer).

create function public.admin_delete_document(
  p_document_id uuid,
  p_reason text
)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.documents;
  v_versions jsonb;
  v_transitions jsonb;
  v_file_paths text[];
begin
  if v_actor is null or not public.is_admin(v_actor) then
    raise exception 'Hanya admin yang boleh menghapus dokumen.';
  end if;
  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'Alasan penghapusan wajib diisi.';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'Dokumen tidak ditemukan.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) into v_versions
    from public.document_versions v where v.document_id = p_document_id;

  select coalesce(array_agg(v.file_path), array[]::text[]) into v_file_paths
    from public.document_versions v where v.document_id = p_document_id;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_transitions
    from public.stage_transitions t where t.document_id = p_document_id;

  insert into public.deleted_documents_log (
    original_document_id, nomor_surat_tugas, nama_laporan, submitter_id,
    ketua_tim_id, dalnis_id, dalmut_id, operator_id, current_stage, status,
    versions_snapshot, transitions_snapshot, deleted_by, reason
  ) values (
    v_doc.id, v_doc.nomor_surat_tugas, v_doc.nama_laporan, v_doc.submitter_id,
    v_doc.ketua_tim_id, v_doc.dalnis_id, v_doc.dalmut_id, v_doc.operator_id,
    v_doc.current_stage, v_doc.status, v_versions, v_transitions, v_actor, p_reason
  );

  delete from public.documents where id = p_document_id;

  return v_file_paths;
end;
$$;

grant execute on function public.admin_delete_document to authenticated;
