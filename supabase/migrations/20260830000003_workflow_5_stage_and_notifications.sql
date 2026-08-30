-- SIRVIU — 20260830000003_workflow_5_stage_and_notifications
--
-- BESAR: workflow 7-stage → 5-stage + tambah in-app notifications.
--
-- Konteks perubahan (Aug 2026 · setelah konsultasi calon-user KT):
-- workflow lama menyeret KT bolak-balik: KT upload (1) → Dalnis (2) →
-- KT re-upload (3) → Dalmut (4) → KT re-upload (5) → Operator (6) →
-- Final (7). Calon-user minta: setelah reviewer approve, dokumen
-- LANGSUNG ke reviewer berikutnya (tidak menunggu KT re-upload); dan
-- reject dari Dalmut/Operator kembalinya ke reviewer sebelumnya
-- (Dalnis dari Dalmut, Dalmut dari Operator), bukan lagi ke KT.
--
-- Workflow baru (5 stage):
--   1  KT upload
--   2  Dalnis reviu — bisa approve → 3, revisi (upload versi baru) → 3,
--                     reject → 1 (KT)
--   3  Dalmut reviu — bisa approve → 4, revisi → 4, reject → 2 (Dalnis)
--   4  Operator     — bisa finalize → 5, format_fix + finalize → 5,
--                     reject → 3 (Dalmut)
--   5  Final
--
-- RPC baru: `reviewer_revise_and_forward` — Dalnis/Dalmut upload versi
-- baru dari file yang di-review + langsung maju ke stage berikutnya
-- dalam satu transaksi. Konsisten dengan pola `format_fix_and_finalize`
-- yang sudah ada (Operator upload versi terformat + finalize).
--
-- ROLLBACK: snapshot data di `_pre_stage5_migration` tabel supaya bisa
-- di-restore. Rollback script di `supabase/rollbacks/`.
--
-- Notifikasi in-app: table `notifications` + insert dari setiap RPC
-- state-transition, mengirim ke pemegang stage BARU (yang perlu aksi).
-- Detail di bagian 6 di bawah.

set client_min_messages to warning;

-- ============================================================
-- 1. Snapshot data untuk rollback
-- ============================================================
create table if not exists public.documents_pre_stage5_migration as
  select *, now() as snapshotted_at from public.documents;

create table if not exists public.stage_transitions_pre_stage5_migration as
  select *, now() as snapshotted_at from public.stage_transitions;

comment on table public.documents_pre_stage5_migration is
  'Snapshot documents BEFORE 7→5 stage migration (2026-08-30). Rollback source. Do NOT drop tanpa konfirmasi user.';
comment on table public.stage_transitions_pre_stage5_migration is
  'Snapshot stage_transitions BEFORE 7→5 stage migration (2026-08-30). Rollback source.';

-- ============================================================
-- 2. Drop old check constraint (7-stage) + remap existing data
-- ============================================================
alter table public.documents
  drop constraint if exists documents_current_stage_check;

-- Mapping stage lama → baru:
--   1 → 1   (KT upload — sama)
--   2 → 2   (Dalnis reviu — sama)
--   3 → 3   (dulu KT re-upload setelah Dalnis approve; sekarang Dalmut)
--   4 → 3   (dulu Dalmut reviu; sekarang tetap Dalmut)
--   5 → 4   (dulu KT re-upload setelah Dalmut approve; sekarang Operator)
--   6 → 4   (dulu Operator; sekarang tetap Operator)
--   7 → 5   (Final)
--
-- Dokumen yang mapped dari stage 3/5 (dulu KT re-upload) berpindah ke
-- stage reviewer — status apapun (in_progress atau revision_requested)
-- di-normalisasi ke `in_progress` supaya reviewer bisa langsung mereview
-- file yang sudah ada.
update public.documents
set current_stage = case current_stage
    when 1 then 1
    when 2 then 2
    when 3 then 3
    when 4 then 3
    when 5 then 4
    when 6 then 4
    when 7 then 5
  end,
  status = case
    when current_stage in (3, 5) then 'in_progress'
    else status
  end;

alter table public.documents
  add constraint documents_current_stage_check
    check (current_stage between 1 and 5);

-- ============================================================
-- 3. Drop OLD state-machine RPC signatures (untuk clean redefine)
-- ============================================================
drop function if exists public.submit_document(uuid, text);
drop function if exists public.approve_review(uuid, text);
drop function if exists public.reject_review(uuid, int, text);
drop function if exists public.finalize_document(uuid, text);
drop function if exists public.format_fix_and_finalize(uuid, text, text, int, text, text);
drop function if exists public.upload_revision(uuid, text, text, int, text, text);

-- ============================================================
-- 4. RPC baru — state machine 5-stage (dengan admin override)
-- ============================================================

-- ---- 4a. submit_document — KT stage 1 → 2 (Dalnis) ----
create function public.submit_document(
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
  if v_actor is null then raise exception 'Harus login.'; end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;

  if v_doc.status <> 'in_progress' then
    raise exception 'Dokumen tidak dalam status in_progress.';
  end if;
  if v_doc.current_stage <> 1 then
    raise exception 'Submit hanya berlaku di stage 1.';
  end if;
  if v_doc.ketua_tim_id <> v_actor then
    if not public.is_admin(v_actor) then
      raise exception 'Hanya Ketua Tim dokumen ini yang boleh submit.';
    end if;
    v_override := true;
  end if;

  select id into v_version_id
    from public.document_versions
    where document_id = p_document_id
    order by version_number desc
    limit 1;

  update public.documents
    set current_stage = 2, current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override
  ) values (
    p_document_id, v_version_id, 1, 2, 'submit', v_actor, p_comment, v_override
  );

  perform public._notify_stage_holder(v_doc);
  return v_doc;
end;
$$;
grant execute on function public.submit_document to authenticated;

-- ---- 4b. approve_review — Dalnis (2→3) / Dalmut (3→4) ----
create function public.approve_review(
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
  if v_actor is null then raise exception 'Harus login.'; end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;

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
    v_next_stage := 3;
  elsif v_doc.current_stage = 3 then
    if v_doc.dalmut_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Pengendali Mutu dokumen ini yang boleh approve.';
      end if;
      v_override := true;
    end if;
    v_next_stage := 4;
  else
    raise exception 'Approve hanya berlaku di stage 2 atau 3.';
  end if;

  select id into v_version_id
    from public.document_versions
    where document_id = p_document_id
    order by version_number desc
    limit 1;

  update public.documents
    set current_stage = v_next_stage, current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override
  ) values (
    p_document_id, v_version_id, v_next_stage - 1, v_next_stage, 'approve', v_actor, p_comment, v_override
  );

  perform public._notify_stage_holder(v_doc);
  return v_doc;
end;
$$;
grant execute on function public.approve_review to authenticated;

-- ---- 4c. reject_review — targets baru: 2→[1], 3→[2], 4→[3] ----
create function public.reject_review(
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
  if v_actor is null then raise exception 'Harus login.'; end if;
  if trim(coalesce(p_comment, '')) = '' then
    raise exception 'Komentar wajib diisi.';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;

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
      raise exception 'Dari stage 2 hanya bisa kembali ke stage 1 (Ketua Tim).';
    end if;
  elsif v_doc.current_stage = 3 then
    if v_doc.dalmut_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Pengendali Mutu dokumen ini yang boleh mengembalikan.';
      end if;
      v_override := true;
    end if;
    if p_target_stage <> 2 then
      raise exception 'Dari stage 3 hanya bisa kembali ke stage 2 (Pengendali Teknis).';
    end if;
  elsif v_doc.current_stage = 4 then
    if v_doc.operator_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Operator dokumen ini yang boleh mengembalikan.';
      end if;
      v_override := true;
    end if;
    if p_target_stage <> 3 then
      raise exception 'Dari stage 4 hanya bisa kembali ke stage 3 (Pengendali Mutu).';
    end if;
  else
    raise exception 'Kembalikan untuk revisi hanya berlaku di stage 2, 3, atau 4.';
  end if;

  v_from_stage := v_doc.current_stage;

  select id into v_version_id
    from public.document_versions
    where document_id = p_document_id
    order by version_number desc
    limit 1;

  -- Stage 1 (KT) satu-satunya upload stage — target selain itu (2/3)
  -- adalah reviewer, jadi status tetap `in_progress` (reviewer re-review
  -- versi yang sudah ada, tanpa perlu upload baru).
  if p_target_stage = 1 then
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

  -- Supersede approvals di stage > target (reviewer di sana harus review
  -- ulang). from_stage NULL (baris pembuatan dokumen) TIDAK ke-supersede.
  update public.stage_transitions
    set is_superseded = true
    where document_id = p_document_id
      and to_stage > p_target_stage
      and action in ('approve', 'submit', 'revise_and_forward')
      and is_superseded = false;

  perform public._notify_stage_holder(v_doc);
  return v_doc;
end;
$$;
grant execute on function public.reject_review to authenticated;

-- ---- 4d. finalize_document — Operator (4 → 5 Final) ----
create function public.finalize_document(
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
  if v_actor is null then raise exception 'Harus login.'; end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;

  if v_doc.status <> 'in_progress' then
    raise exception 'Dokumen tidak dalam status in_progress.';
  end if;
  if v_doc.current_stage <> 4 then
    raise exception 'Finalize hanya berlaku di stage 4.';
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
    set current_stage = 5,
        status = 'finalized',
        finalized_at = now(),
        current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override
  ) values (
    p_document_id, v_version_id, 4, 5, 'finalize', v_actor, p_comment, v_override
  );

  return v_doc; -- no notif on final: no one is next
end;
$$;
grant execute on function public.finalize_document to authenticated;

-- ---- 4e. format_fix_and_finalize — Operator upload versi terformat + finalize ----
create function public.format_fix_and_finalize(
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
  if v_actor is null then raise exception 'Harus login.'; end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;

  if v_doc.status <> 'in_progress' then
    raise exception 'Dokumen tidak dalam status in_progress.';
  end if;
  if v_doc.current_stage <> 4 then
    raise exception 'Format fix hanya berlaku di stage 4.';
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
    p_document_id, v_version_id, 4, 4, 'format_fix', v_actor, p_comment, v_override
  );

  update public.documents
    set current_stage = 5,
        status = 'finalized',
        finalized_at = now(),
        current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, is_admin_override
  ) values (
    p_document_id, v_version_id, 4, 5, 'finalize', v_actor, v_override
  );

  return v_doc;
end;
$$;
grant execute on function public.format_fix_and_finalize to authenticated;

-- ---- 4f. upload_revision — KT re-upload di stage 1 (setelah Dalnis reject) ----
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
  v_override boolean := false;
begin
  if v_actor is null then raise exception 'Harus login.'; end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;

  if v_doc.status <> 'revision_requested' then
    raise exception 'Upload revisi hanya berlaku saat status revision_requested.';
  end if;
  if v_doc.current_stage <> 1 then
    raise exception 'Upload revisi hanya berlaku di stage 1.';
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
    p_document_id, v_version_id, 1, 1, 'upload_revision', v_actor, p_upload_notes, v_override
  );

  update public.documents
    set status = 'in_progress'
    where id = p_document_id
    returning * into v_doc;

  return v_doc; -- KT still holds it; no new holder to notify
end;
$$;
grant execute on function public.upload_revision to authenticated;

-- ---- 4g. reviewer_revise_and_forward — Dalnis/Dalmut revisi + forward ----
-- Reviewer upload versi baru (revisi hasil koreksi sendiri) + langsung
-- maju ke reviewer berikutnya, dalam satu transaksi. Konsisten dengan
-- pola format_fix_and_finalize (2 stage_transitions: revise_and_forward
-- + advance).
create function public.reviewer_revise_and_forward(
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
        raise exception 'Hanya Pengendali Mutu dokumen ini yang boleh revisi.';
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
    p_document_id, v_version_id, v_doc.current_stage, v_doc.current_stage, 'revise_and_forward', v_actor, p_comment, v_override
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
grant execute on function public.reviewer_revise_and_forward to authenticated;

-- ============================================================
-- 5. Loosen version RLS to permit reviewer uploads
-- ============================================================
-- Existing document_versions_insert policy hanya izinkan uploader = KT.
-- Reviewer sekarang juga upload (via revise_and_forward / format_fix),
-- jadi harus juga bisa insert versi. RPC-nya sudah gate stage+assignment
-- di-plpgsql, jadi RLS di sini cukup memastikan uploader = auth.uid()
-- dan user memang salah satu peran di dokumen.
drop policy if exists document_versions_insert on public.document_versions;
create policy document_versions_insert on public.document_versions
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.documents d
      where d.id = document_id
        and (
          d.ketua_tim_id = auth.uid()
          or d.dalnis_id  = auth.uid()
          or d.dalmut_id  = auth.uid()
          or d.operator_id = auth.uid()
          or public.is_admin(auth.uid())
        )
    )
  );

-- ============================================================
-- 6. Notifications
-- ============================================================
-- Table + RLS + helper RPC. Setiap state-transition RPC di atas
-- memanggil `_notify_stage_holder(doc)` yang insert notif ke pemegang
-- stage baru (kalau ada). Notifikasi tidak dikirim untuk aksi yang
-- tidak butuh respons — misal finalize (dokumen selesai, no next
-- holder) dan upload_revision (KT masih pemegang stage-nya).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  stage int not null,
  action text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, created_at desc)
  where read_at is null;

create index if not exists idx_notifications_user_recent
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- Insert HANYA lewat RPC security-definer (`_notify_stage_holder`) —
-- tidak ada policy INSERT untuk authenticated, artinya client tidak
-- bisa langsung membuat notifikasi palsu.
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Helper: insert notif ke pemegang stage baru. Dipanggil dari setiap
-- RPC state-transition di atas. Kalau tidak ada holder (stage 5 Final),
-- silent no-op.
create or replace function public._notify_stage_holder(v_doc public.documents)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target uuid;
  v_message text;
  v_action text;
begin
  case v_doc.current_stage
    when 1 then
      v_target := v_doc.ketua_tim_id;
      v_action := 'need_upload_revision';
      v_message := 'Dokumen dikembalikan — Anda perlu upload revisi.';
    when 2 then
      v_target := v_doc.dalnis_id;
      v_action := 'need_review';
      v_message := 'Dokumen siap direviu oleh Pengendali Teknis.';
    when 3 then
      v_target := v_doc.dalmut_id;
      v_action := 'need_review';
      v_message := 'Dokumen siap direviu oleh Pengendali Mutu.';
    when 4 then
      v_target := v_doc.operator_id;
      v_action := 'need_finalize';
      v_message := 'Dokumen siap difinalisasi oleh Operator.';
    else
      return; -- stage 5 Final: tidak ada holder
  end case;

  if v_target is null then return; end if;

  insert into public.notifications (user_id, document_id, stage, action, message)
  values (v_target, v_doc.id, v_doc.current_stage, v_action, v_message);
end;
$$;

-- Marks: user mark one / all as read.
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Harus login.'; end if;
  update public.notifications
    set read_at = now()
    where id = p_notification_id and user_id = v_actor and read_at is null;
end;
$$;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_count int;
begin
  if v_actor is null then raise exception 'Harus login.'; end if;
  update public.notifications
    set read_at = now()
    where user_id = v_actor and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ============================================================
-- 7. Update ACTION_LABELS support: `revise_and_forward` action valid.
-- ============================================================
-- stage_transitions.action check constraint (kalau ada) mungkin batasi
-- action list. Cek migration awal — kalau ada `check (action in (...))`,
-- kita perlu update. Kalau tidak ada, action text bebas.
do $$
begin
  if exists (
    select 1
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name like 'stage_transitions_action%'
  ) then
    alter table public.stage_transitions drop constraint stage_transitions_action_check;
    alter table public.stage_transitions
      add constraint stage_transitions_action_check
      check (action in ('submit', 'approve', 'reject', 'finalize', 'format_fix', 'upload_revision', 'revise_and_forward', 'cancel'));
  end if;
end $$;
