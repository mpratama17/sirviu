-- SIRVIU — 20260828000008_enforce_distinct_reviewers
--
-- Real gap found while investigating a user question about dual-role users
-- (satu orang bisa pegang role 'dalnis' DAN 'dalmut' sekaligus — itu sendiri
-- sah, brief tidak melarang satu orang punya banyak role). Yang TIDAK boleh
-- adalah orang yang SAMA menjadi lebih dari satu penugasan di DOKUMEN yang
-- sama (self-review — Dalnis meng-approve reviu dirinya sendiri sebagai
-- Dalmut, misalnya). `document-form.tsx`/`edit-document-modal.tsx` sudah
-- mencegah ini di client (UserCombobox `disabledIds`), tapi RPC (trust
-- boundary sebenarnya, lihat AGENTS.md) sama sekali tidak mengecek ulang —
-- dibuktikan langsung: panggil `create_document` lewat RPC dengan
-- dalnis_id = dalmut_id BERHASIL, melewati guard client sepenuhnya.
--
-- Fix: `create_document` dan `admin_update_document_metadata` sekarang
-- menolak kalau keempat id (ketua_tim/dalnis/dalmut/operator) bukan 4
-- orang yang benar-benar berbeda.

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

  if (
    select count(distinct x)
    from unnest(array[p_ketua_tim_id, p_dalnis_id, p_dalmut_id, p_operator_id]) as x
  ) < 4 then
    raise exception 'Ketua Tim, Pengendali Teknis, Pengendali Mutu, dan Operator harus 4 orang berbeda — satu orang tidak boleh merangkap lebih dari satu peran di dokumen yang sama.';
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
    raise exception 'Ketua Tim, Pengendali Teknis, Pengendali Mutu, dan Operator harus 4 orang berbeda — satu orang tidak boleh merangkap lebih dari satu peran di dokumen yang sama.';
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
