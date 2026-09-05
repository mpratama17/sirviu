-- Fix: notifikasi "perlu direviu/upload/finalize" tidak pernah otomatis
-- ditandai selesai ketika dokumennya sudah benar-benar dikerjakan —
-- cuma bisa hilang kalau user klik manual di lonceng notifikasi
-- (mark_notification_read / mark_all_notifications_read). Akibatnya
-- notif tetap "aktif" di lonceng walaupun aksinya sudah dieksekusi.
--
-- Dilaporkan user (2026-09-03) lewat testing manual: dokumen yang sudah
-- dieksekusi (mis. sudah difinalisasi) masih nunjukkin notif seolah
-- belum dikerjakan.
--
-- Root cause: TIGA RPC state-transition (finalize_document,
-- format_fix_and_finalize, upload_revision) berakhir di stage tanpa
-- holder baru (final, atau balik ke aktor sendiri) dan sengaja SKIP
-- manggil `_notify_stage_holder` — jadi notif lama punya aktor itu
-- sendiri (mis. "Dokumen siap difinalisasi" utk operator, atau
-- "perlu upload revisi" utk KT) tidak pernah ke-clear. Empat RPC
-- lain (submit/approve/reject/revise_and_forward) MEMANG manggil
-- `_notify_stage_holder`, tapi fungsi itu sendiri juga tidak pernah
-- membersihkan notif LAMA sebelum insert notif baru — jadi kalau
-- dokumen sempat ditolak-maju berkali-kali, notif basi dari beberapa
-- putaran sebelumnya (ke user yang berbeda-beda) numpuk tak pernah
-- clear.
--
-- Fix: helper baru `_clear_document_notifications(document_id)` —
-- tandai semua notifikasi dokumen itu yang belum dibaca jadi read,
-- siapa pun usernya. Begitu dokumen pindah state (apa pun aksinya),
-- notif LAMA soal dokumen itu otomatis basi — dipanggil dari SEMUA
-- 7 RPC state-transition, bukan cuma yang sudah manggil
-- `_notify_stage_holder`. Untuk yang 4 itu, dipanggil DARI DALAM
-- `_notify_stage_holder` (satu titik, bukan diulang di tiap RPC) —
-- untuk `upload_revision` dipanggil terpisah (BUKAN lewat
-- `_notify_stage_holder`, karena itu akan insert ulang notif
-- "perlu upload revisi" ke KT yang justru baru saja upload).
-- `finalize_document`/`format_fix_and_finalize` dipanggil lewat
-- `_notify_stage_holder(v_doc)` seperti RPC lain — aman karena
-- fungsi itu sendiri no-op utk stage 5 (tidak ada holder), efek yang
-- dipakai di sini murni clear-nya.

create or replace function public._clear_document_notifications(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.notifications
    set read_at = now()
    where document_id = p_document_id and read_at is null;
end;
$$;

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
  perform public._clear_document_notifications(v_doc.id);

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
      v_message := 'Dokumen siap direviu oleh Irban (Pengendali Mutu).';
    when 4 then
      v_target := v_doc.operator_id;
      v_action := 'need_finalize';
      v_message := 'Dokumen siap difinalisasi oleh Operator.';
    else
      return; -- stage 5 Final: tidak ada holder (clear di atas tetap jalan)
  end case;

  if v_target is null then return; end if;

  insert into public.notifications (user_id, document_id, stage, action, message)
  values (v_target, v_doc.id, v_doc.current_stage, v_action, v_message);
end;
$$;

-- finalize_document dan format_fix_and_finalize sebelumnya `return`
-- langsung tanpa notify apa pun ("no one is next") — sekarang keduanya
-- manggil _notify_stage_holder murni buat efek clear-nya (no-op utk
-- insert notif baru karena stage-nya 5).

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

  perform public._notify_stage_holder(v_doc); -- clear notif "perlu finalize" milik operator; no notif baru (stage 5)
  return v_doc;
end;
$$;

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

  perform public._notify_stage_holder(v_doc); -- clear notif "perlu finalize" milik operator; no notif baru (stage 5)
  return v_doc;
end;
$$;

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

  -- KT tetap pemegang stage 1 (belum ada holder baru buat dinotif),
  -- tapi notif "perlu upload revisi" milik KT sendiri sudah basi —
  -- clear langsung, JANGAN lewat _notify_stage_holder (itu akan
  -- insert ulang notif yang sama ke KT).
  perform public._clear_document_notifications(v_doc.id);
  return v_doc;
end;
$$;

comment on function public._clear_document_notifications(uuid) is
  'Tandai semua notifikasi dokumen ini yang belum dibaca jadi read — dipanggil tiap kali dokumen pindah state, karena notif "perlu aksi" yang lama otomatis basi begitu aksinya (apa pun itu) sudah dieksekusi.';
