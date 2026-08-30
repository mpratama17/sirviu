-- ROLLBACK untuk 20260830000003_workflow_5_stage_and_notifications
--
-- Kembalikan workflow ke 7-stage lama. Lossless untuk dokumen yang ada
-- di snapshot; dokumen BARU (dibuat setelah forward migration) di-map
-- balik dari 5-stage ke 7-stage seakurat mungkin.
--
-- CARA JALANIN (manual, TIDAK diambil oleh supabase db push):
--   1. Deploy code lama ke Vercel: `git revert <sha commit forward migration>`
--      + `vercel --prod` (supaya UI tidak error dgn schema 7-stage baru).
--   2. Buka Supabase Dashboard → Database → SQL Editor.
--   3. Paste file ini SELURUHNYA, jalankan.
--   4. Verifikasi: query `select current_stage, count(*) from documents
--      group by 1;` — hasilnya harus dalam range 1..7.
--   5. Optional: setelah yakin rollback sukses & data valid, DROP tabel
--      snapshot: `drop table documents_pre_stage5_migration;` dst.
--
-- Rollback ini DESTRUKTIF (data setelah forward migration hilang bila
-- kamu memilih path A). Baca opsi di bagian 2 di bawah.

set client_min_messages to warning;

-- ============================================================
-- 1. Restore RPC lama (7-stage) — copy dari migration 000007 versi
--    admin-full-access, karena itu versi terakhir sebelum forward.
-- ============================================================

drop function if exists public.submit_document(uuid, text);
drop function if exists public.approve_review(uuid, text);
drop function if exists public.reject_review(uuid, int, text);
drop function if exists public.finalize_document(uuid, text);
drop function if exists public.format_fix_and_finalize(uuid, text, text, int, text, text);
drop function if exists public.upload_revision(uuid, text, text, int, text, text);
drop function if exists public.reviewer_revise_and_forward(uuid, text, text, int, text, text);

-- submit_document (7-stage: KT di 1/3/5)
create function public.submit_document(p_document_id uuid, p_comment text default null)
returns public.documents language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_doc public.documents; v_version_id uuid;
        v_next_stage int; v_override boolean := false;
begin
  if v_actor is null then raise exception 'Harus login.'; end if;
  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  if v_doc.status <> 'in_progress' then raise exception 'Dokumen tidak dalam status in_progress.'; end if;
  if v_doc.current_stage not in (1, 3, 5) then raise exception 'Submit hanya berlaku di stage 1, 3, atau 5.'; end if;
  if v_doc.ketua_tim_id <> v_actor then
    if not public.is_admin(v_actor) then raise exception 'Hanya Ketua Tim dokumen ini yang boleh submit.'; end if;
    v_override := true;
  end if;
  v_next_stage := v_doc.current_stage + 1;
  select id into v_version_id from public.document_versions where document_id = p_document_id order by version_number desc limit 1;
  update public.documents set current_stage = v_next_stage, current_stage_started_at = now()
    where id = p_document_id returning * into v_doc;
  insert into public.stage_transitions (document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override)
    values (p_document_id, v_version_id, v_doc.current_stage - 1, v_next_stage, 'submit', v_actor, p_comment, v_override);
  return v_doc;
end $$;
grant execute on function public.submit_document to authenticated;

-- approve_review (7-stage: Dalnis 2, Dalmut 4)
create function public.approve_review(p_document_id uuid, p_comment text default null)
returns public.documents language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_doc public.documents; v_version_id uuid;
        v_next_stage int; v_override boolean := false;
begin
  if v_actor is null then raise exception 'Harus login.'; end if;
  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  if v_doc.status <> 'in_progress' then raise exception 'Dokumen tidak dalam status in_progress.'; end if;
  if v_doc.current_stage = 2 then
    if v_doc.dalnis_id <> v_actor then
      if not public.is_admin(v_actor) then raise exception 'Hanya Pengendali Teknis dokumen ini yang boleh approve.'; end if;
      v_override := true;
    end if;
  elsif v_doc.current_stage = 4 then
    if v_doc.dalmut_id <> v_actor then
      if not public.is_admin(v_actor) then raise exception 'Hanya Pengendali Mutu dokumen ini yang boleh approve.'; end if;
      v_override := true;
    end if;
  else raise exception 'Approve hanya berlaku di stage 2 atau 4.'; end if;
  v_next_stage := v_doc.current_stage + 1;
  select id into v_version_id from public.document_versions where document_id = p_document_id order by version_number desc limit 1;
  update public.documents set current_stage = v_next_stage, current_stage_started_at = now()
    where id = p_document_id returning * into v_doc;
  insert into public.stage_transitions (document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override)
    values (p_document_id, v_version_id, v_doc.current_stage - 1, v_next_stage, 'approve', v_actor, p_comment, v_override);
  return v_doc;
end $$;
grant execute on function public.approve_review to authenticated;

-- reject_review (7-stage: 2→[1], 4→[1,2,3], 6→[1,2,3,4,5])
create function public.reject_review(p_document_id uuid, p_target_stage int, p_comment text)
returns public.documents language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_doc public.documents; v_version_id uuid;
        v_from_stage int; v_new_status text; v_override boolean := false;
begin
  if v_actor is null then raise exception 'Harus login.'; end if;
  if trim(coalesce(p_comment, '')) = '' then raise exception 'Komentar wajib diisi.'; end if;
  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  if v_doc.status <> 'in_progress' then raise exception 'Dokumen tidak dalam status in_progress.'; end if;
  if v_doc.current_stage = 2 then
    if v_doc.dalnis_id <> v_actor then
      if not public.is_admin(v_actor) then raise exception 'Hanya Pengendali Teknis dokumen ini yang boleh mengembalikan.'; end if;
      v_override := true;
    end if;
    if p_target_stage <> 1 then raise exception 'Dari stage 2 hanya bisa kembali ke stage 1.'; end if;
  elsif v_doc.current_stage = 4 then
    if v_doc.dalmut_id <> v_actor then
      if not public.is_admin(v_actor) then raise exception 'Hanya Pengendali Mutu dokumen ini yang boleh mengembalikan.'; end if;
      v_override := true;
    end if;
    if p_target_stage not in (1, 2, 3) then raise exception 'Dari stage 4 hanya bisa kembali ke stage 1, 2, atau 3.'; end if;
  elsif v_doc.current_stage = 6 then
    if v_doc.operator_id <> v_actor then
      if not public.is_admin(v_actor) then raise exception 'Hanya Operator dokumen ini yang boleh mengembalikan.'; end if;
      v_override := true;
    end if;
    if p_target_stage not in (1, 2, 3, 4, 5) then raise exception 'Dari stage 6 hanya bisa kembali ke stage 1-5.'; end if;
  else raise exception 'Kembalikan untuk revisi hanya berlaku di stage 2, 4, atau 6.'; end if;
  v_from_stage := v_doc.current_stage;
  select id into v_version_id from public.document_versions where document_id = p_document_id order by version_number desc limit 1;
  if p_target_stage in (1, 3, 5) then v_new_status := 'revision_requested'; else v_new_status := 'in_progress'; end if;
  update public.documents set current_stage = p_target_stage, status = v_new_status, current_stage_started_at = now()
    where id = p_document_id returning * into v_doc;
  insert into public.stage_transitions (document_id, version_id, from_stage, to_stage, action, actor_id, comment, target_stage_on_reject, is_admin_override)
    values (p_document_id, v_version_id, v_from_stage, p_target_stage, 'reject', v_actor, p_comment, p_target_stage, v_override);
  update public.stage_transitions set is_superseded = true
    where document_id = p_document_id and to_stage > p_target_stage
      and action in ('approve', 'submit') and is_superseded = false;
  return v_doc;
end $$;
grant execute on function public.reject_review to authenticated;

-- finalize_document (7-stage: Operator di 6 → 7)
create function public.finalize_document(p_document_id uuid, p_comment text default null)
returns public.documents language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_doc public.documents; v_version_id uuid; v_override boolean := false;
begin
  if v_actor is null then raise exception 'Harus login.'; end if;
  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  if v_doc.status <> 'in_progress' then raise exception 'Dokumen tidak dalam status in_progress.'; end if;
  if v_doc.current_stage <> 6 then raise exception 'Finalize hanya berlaku di stage 6.'; end if;
  if v_doc.operator_id <> v_actor then
    if not public.is_admin(v_actor) then raise exception 'Hanya Operator dokumen ini yang boleh finalize.'; end if;
    v_override := true;
  end if;
  select id into v_version_id from public.document_versions where document_id = p_document_id order by version_number desc limit 1;
  update public.documents set current_stage = 7, status = 'finalized', finalized_at = now(), current_stage_started_at = now()
    where id = p_document_id returning * into v_doc;
  insert into public.stage_transitions (document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override)
    values (p_document_id, v_version_id, 6, 7, 'finalize', v_actor, p_comment, v_override);
  return v_doc;
end $$;
grant execute on function public.finalize_document to authenticated;

-- format_fix_and_finalize (7-stage: Operator di 6 → 7)
create function public.format_fix_and_finalize(p_document_id uuid, p_file_path text, p_file_name text, p_file_size int, p_mime_type text, p_comment text default null)
returns public.documents language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_doc public.documents; v_next_version int; v_version_id uuid; v_override boolean := false;
begin
  if v_actor is null then raise exception 'Harus login.'; end if;
  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  if v_doc.status <> 'in_progress' then raise exception 'Dokumen tidak dalam status in_progress.'; end if;
  if v_doc.current_stage <> 6 then raise exception 'Format fix hanya berlaku di stage 6.'; end if;
  if v_doc.operator_id <> v_actor then
    if not public.is_admin(v_actor) then raise exception 'Hanya Operator dokumen ini yang boleh format fix.'; end if;
    v_override := true;
  end if;
  select coalesce(max(version_number), 0) + 1 into v_next_version from public.document_versions where document_id = p_document_id;
  insert into public.document_versions (document_id, version_number, file_path, file_name, file_size, mime_type, uploaded_by, upload_notes)
    values (p_document_id, v_next_version, p_file_path, p_file_name, p_file_size, p_mime_type, v_actor, p_comment)
    returning id into v_version_id;
  insert into public.stage_transitions (document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override)
    values (p_document_id, v_version_id, 6, 6, 'format_fix', v_actor, p_comment, v_override);
  update public.documents set current_stage = 7, status = 'finalized', finalized_at = now(), current_stage_started_at = now()
    where id = p_document_id returning * into v_doc;
  insert into public.stage_transitions (document_id, version_id, from_stage, to_stage, action, actor_id, is_admin_override)
    values (p_document_id, v_version_id, 6, 7, 'finalize', v_actor, v_override);
  return v_doc;
end $$;
grant execute on function public.format_fix_and_finalize to authenticated;

-- upload_revision (7-stage: KT di 1/3/5)
create function public.upload_revision(p_document_id uuid, p_file_path text, p_file_name text, p_file_size int, p_mime_type text, p_upload_notes text default null)
returns public.documents language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_doc public.documents; v_next_version int; v_version_id uuid; v_override boolean := false;
begin
  if v_actor is null then raise exception 'Harus login.'; end if;
  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  if v_doc.status <> 'revision_requested' then raise exception 'Upload revisi hanya berlaku saat status revision_requested.'; end if;
  if v_doc.current_stage not in (1, 3, 5) then raise exception 'Upload revisi hanya berlaku di stage 1, 3, atau 5.'; end if;
  if v_doc.ketua_tim_id <> v_actor then
    if not public.is_admin(v_actor) then raise exception 'Hanya Ketua Tim dokumen ini yang boleh upload revisi.'; end if;
    v_override := true;
  end if;
  select coalesce(max(version_number), 0) + 1 into v_next_version from public.document_versions where document_id = p_document_id;
  insert into public.document_versions (document_id, version_number, file_path, file_name, file_size, mime_type, uploaded_by, upload_notes)
    values (p_document_id, v_next_version, p_file_path, p_file_name, p_file_size, p_mime_type, v_actor, p_upload_notes)
    returning id into v_version_id;
  insert into public.stage_transitions (document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_admin_override)
    values (p_document_id, v_version_id, v_doc.current_stage, v_doc.current_stage, 'upload_revision', v_actor, p_upload_notes, v_override);
  update public.documents set status = 'in_progress' where id = p_document_id returning * into v_doc;
  return v_doc;
end $$;
grant execute on function public.upload_revision to authenticated;

-- ============================================================
-- 2. Restore data — pilih SATU dari dua opsi berikut, HAPUS opsi
--    yang tidak dipakai sebelum jalankan.
-- ============================================================

-- OPSI A (LOSSY, LEBIH AMAN): restore semua dokumen dari snapshot
-- (buang perubahan dari sesudah forward migration). Cocok kalau
-- setelah forward migration kamu belum ada aktivitas nyata.
-- ------------------------------------------------------------
alter table public.documents drop constraint if exists documents_current_stage_check;
delete from public.stage_transitions where document_id in (select id from public.documents);
delete from public.document_versions where document_id in (select id from public.documents);
delete from public.documents;
insert into public.documents select *
  from (select d.* from public.documents_pre_stage5_migration d) src
  on conflict (id) do nothing;
-- (transitions/versions kembali muncul karena FK on delete cascade tidak
-- restore data lama — kalau kamu perlu restore juga stage_transitions:
-- uncomment ini:)
-- insert into public.stage_transitions select id, document_id, version_id, from_stage, to_stage, action, actor_id, comment, is_superseded, is_admin_override, target_stage_on_reject, created_at
--   from public.stage_transitions_pre_stage5_migration;
alter table public.documents
  add constraint documents_current_stage_check check (current_stage between 1 and 7);

-- OPSI B (LOSSLESS UNTUK FORWARD DATA, BEST-EFFORT REMAP): map
-- current_stage 5-stage baru → 7-stage lama. Beberapa stage bisa jadi
-- ambigu (misal stage 3-baru bisa mapped ke 3-lama atau 4-lama), kita
-- pilih yang paling mendekati semantik (reviewer stage).
-- Uncomment kalau mau pakai; comment out OPSI A di atas.
-- ------------------------------------------------------------
-- alter table public.documents drop constraint if exists documents_current_stage_check;
-- update public.documents set current_stage = case current_stage
--     when 1 then 1  -- KT
--     when 2 then 2  -- Dalnis
--     when 3 then 4  -- Dalmut (skip stage 3 lama KT-re-upload)
--     when 4 then 6  -- Operator (skip stage 5 lama KT-re-upload)
--     when 5 then 7  -- Final
--   end;
-- alter table public.documents
--   add constraint documents_current_stage_check check (current_stage between 1 and 7);

-- ============================================================
-- 3. Cleanup: drop notifications feature + revert action check
-- ============================================================
drop function if exists public.mark_all_notifications_read();
drop function if exists public.mark_notification_read(uuid);
drop function if exists public._notify_stage_holder(public.documents);
drop table if exists public.notifications;

do $$
begin
  if exists (
    select 1 from information_schema.check_constraints
    where constraint_schema = 'public' and constraint_name like 'stage_transitions_action%'
  ) then
    alter table public.stage_transitions drop constraint stage_transitions_action_check;
    alter table public.stage_transitions
      add constraint stage_transitions_action_check
      check (action in ('submit', 'approve', 'reject', 'finalize', 'format_fix', 'upload_revision', 'cancel'));
  end if;
end $$;

-- ============================================================
-- 4. (Optional) drop snapshot tables setelah rollback verified
-- ============================================================
-- drop table if exists public.documents_pre_stage5_migration;
-- drop table if exists public.stage_transitions_pre_stage5_migration;
