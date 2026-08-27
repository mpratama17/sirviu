-- SIRVIU — 20260828000004_review_action_functions
-- Milestone 3: RPC untuk submit/approve/reject/finalize/format_fix.
-- Sama seperti create_document (lihat ...000003), semua security definer,
-- actor_id derived dari auth.uid(), dipanggil lewat session client user
-- (bukan service role). Lihat AGENTS.md "State-machine mutations".
--
-- Setiap function pakai `select ... for update` di baris documents supaya
-- dua aksi bersamaan (mis. dobel-klik approve) tidak balapan.
--
-- `current_stage_started_at` di-reset di SEMUA transisi (bukan cuma
-- reject) — dipakai `DaysInStage` indicator di semua dokumen, brief §5.2
-- cuma sebut reject tapi kalau tidak di-reset di semua transisi,
-- indicator itu salah sepanjang happy path.

-- ============================================================
-- submit_document — KT di stage 1/3/5 maju ke stage berikutnya
-- ============================================================
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
  v_next_stage int;
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
    raise exception 'Hanya Ketua Tim dokumen ini yang boleh submit.';
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
    document_id, version_id, from_stage, to_stage, action, actor_id, comment
  ) values (
    p_document_id, v_version_id, v_doc.current_stage - 1, v_next_stage, 'submit', v_actor, p_comment
  );

  return v_doc;
end;
$$;

grant execute on function public.submit_document to authenticated;

-- ============================================================
-- approve_review — Dalnis (stage 2) / Dalmut (stage 4) approve
-- ============================================================
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
      raise exception 'Hanya Pengendali Teknis dokumen ini yang boleh approve.';
    end if;
  elsif v_doc.current_stage = 4 then
    if v_doc.dalmut_id <> v_actor then
      raise exception 'Hanya Pengendali Mutu dokumen ini yang boleh approve.';
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
    document_id, version_id, from_stage, to_stage, action, actor_id, comment
  ) values (
    p_document_id, v_version_id, v_doc.current_stage - 1, v_next_stage, 'approve', v_actor, p_comment
  );

  return v_doc;
end;
$$;

grant execute on function public.approve_review to authenticated;

-- ============================================================
-- reject_review — Dalnis/Dalmut/Operator (stage 2/4/6) kembalikan revisi
-- ============================================================
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

  update public.documents
    set current_stage = p_target_stage,
        status = 'revision_requested',
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

-- ============================================================
-- finalize_document — Operator di stage 6 finalize langsung
-- ============================================================
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
    raise exception 'Hanya Operator dokumen ini yang boleh finalize.';
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
    document_id, version_id, from_stage, to_stage, action, actor_id, comment
  ) values (
    p_document_id, v_version_id, 6, 7, 'finalize', v_actor, p_comment
  );

  return v_doc;
end;
$$;

grant execute on function public.finalize_document to authenticated;

-- ============================================================
-- format_fix_and_finalize — Operator upload versi hasil perbaikan
-- format, lalu langsung finalize. Dua stage_transitions rows
-- (format_fix, lalu finalize) + satu document_versions baru, brief §5.3(2).
-- File HARUS sudah ter-upload ke storage sebelum RPC ini dipanggil
-- (storage tidak transactional dengan Postgres) — sama seperti
-- create_document. version_number di-derive ULANG di sini dari
-- max+1 (bukan dipercaya dari parameter) supaya otoritatif walau
-- ada race; `unique(document_id, version_number)` jadi pengaman terakhir.
-- ============================================================
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
    raise exception 'Hanya Operator dokumen ini yang boleh format fix.';
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
    document_id, version_id, from_stage, to_stage, action, actor_id, comment
  ) values (
    p_document_id, v_version_id, 6, 6, 'format_fix', v_actor, p_comment
  );

  update public.documents
    set current_stage = 7,
        status = 'finalized',
        finalized_at = now(),
        current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id
  ) values (
    p_document_id, v_version_id, 6, 7, 'finalize', v_actor
  );

  return v_doc;
end;
$$;

grant execute on function public.format_fix_and_finalize to authenticated;
