-- SIRVIU — 20260901000003_irban_terminology
--
-- Permintaan user (1 Sep 2026): istilah role dalmut berubah nama tampilan
-- menjadi "Irban (Pengendali Mutu)". Role/kolom DB tetap "dalmut" di mana
-- pun — cuma teks yang dibaca user (pesan error RPC, notifikasi) yang
-- berubah, sama seperti perubahan ROLE_LABELS.dalmut di frontend.
--
-- Lima fungsi ini adalah SATU-SATUNYA tempat teks "Pengendali Mutu"
-- muncul di layer database (exception message yang jadi toast error, dan
-- notifikasi yang masuk ke lonceng notifikasi user) — ditelusuri dari
-- versi TERBARU tiap fungsi (create_document baru saja di-replace lagi di
-- ...000001 pagi ini). Tidak ada perubahan logika sama sekali, murni
-- ganti string.

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
        raise exception 'Hanya Irban (Pengendali Mutu) dokumen ini yang boleh approve.';
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
        raise exception 'Hanya Irban (Pengendali Mutu) dokumen ini yang boleh mengembalikan.';
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
      raise exception 'Dari stage 4 hanya bisa kembali ke stage 3 (Irban / Pengendali Mutu).';
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
      v_message := 'Dokumen siap direviu oleh Irban (Pengendali Mutu).';
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

create or replace function public.admin_update_document_metadata(
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

  if (
    select count(distinct x)
    from unnest(array[p_ketua_tim_id, p_dalnis_id, p_dalmut_id, p_operator_id]) as x
  ) < 4 then
    raise exception 'Ketua Tim, Pengendali Teknis, Irban (Pengendali Mutu), dan Operator harus 4 orang berbeda — satu orang tidak boleh merangkap lebih dari satu peran di dokumen yang sama.';
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

  if not public.is_admin(v_actor) and p_ketua_tim_id is distinct from v_actor then
    raise exception 'Ketua Tim dokumen harus diri Anda sendiri.';
  end if;

  if (
    select count(distinct x)
    from unnest(array[p_ketua_tim_id, p_dalnis_id, p_dalmut_id, p_operator_id]) as x
  ) < 4 then
    raise exception 'Ketua Tim, Pengendali Teknis, Irban (Pengendali Mutu), dan Operator harus 4 orang berbeda — satu orang tidak boleh merangkap lebih dari satu peran di dokumen yang sama.';
  end if;

  if not public.is_admin(v_actor) and exists (
    select 1 from public.users
    where id in (p_dalnis_id, p_dalmut_id, p_operator_id)
      and team_ketua_tim_id is distinct from p_ketua_tim_id
  ) then
    raise exception 'Pengendali Teknis, Irban (Pengendali Mutu), dan Operator harus anggota tim Ketua Tim yang dipilih.';
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
