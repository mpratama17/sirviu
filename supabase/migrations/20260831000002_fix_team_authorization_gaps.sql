-- SIRVIU — 20260831000002_fix_team_authorization_gaps
--
-- Dua celah yang ketahuan saat testing migration ...000001 (team isolation).
--
-- 1. `create_document` memvalidasi keanggotaan tim terhadap `p_ketua_tim_id`
--    — PARAMETER DARI CLIENT — bukan terhadap `auth.uid()`. Tidak ada satu
--    pun check yang mengikat p_ketua_tim_id ke actor. Artinya Ketua Tim A
--    bisa kirim p_ketua_tim_id = (id Ketua Tim B) beserta anggota-anggota
--    tim B, dan semua check LOLOS (mereka memang satu tim — timnya B).
--    Hasilnya dokumen milik tim B dibuat oleh A — persis "campur antar tim"
--    yang migration ...000001 dibuat untuk mencegah.
--
--    Ini kelas bug yang sama yang sudah dua kali didokumentasikan di
--    AGENTS.md (`enforce_distinct_reviewers`, `reject_review`): aturan yang
--    cuma hidup di UI. `document-form.tsx` memang mengunci field Ketua Tim
--    ke diri sendiri, tapi RPC — trust boundary sebenarnya — menerima id
--    siapa saja. Sebelum ...000001 celah ini ada tapi tidak load-bearing;
--    setelah ...000001 "tim" jadi unit otorisasi, jadi menurunkan tim dari
--    input client persis melubangi isolasi yang baru dibangun.
--
--    Fix: non-admin wajib p_ketua_tim_id = auth.uid(). Admin tetap bebas
--    lintas tim (override pattern, AGENTS.md).
--
-- 2. `storage_documents_select` di ...000001 memindahkan `is_admin()` dari
--    LUAR `exists(...)` ke DALAM. Efek samping yang tidak disengaja: admin
--    kehilangan akses ke object yang TIDAK punya baris `documents`
--    pasangannya — dan object yatim memang bisa ada (lihat
--    `lib/actions/documents.ts`: upload storage terjadi SEBELUM insert DB,
--    kalau RPC gagal setelah upload sukses filenya jadi orphan). Fix:
--    kembalikan `is_admin()` ke level luar seperti policy aslinya.

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

  -- Tim dokumen harus tim SI PEMANGGIL, bukan tim yang ditunjuk lewat
  -- parameter. Tanpa ini, check keanggotaan di bawah bisa divalidasi
  -- terhadap tim orang lain (lihat header migration).
  if not public.is_admin(v_actor) and p_ketua_tim_id <> v_actor then
    raise exception 'Ketua Tim dokumen harus diri Anda sendiri.';
  end if;

  if (
    select count(distinct x)
    from unnest(array[p_ketua_tim_id, p_dalnis_id, p_dalmut_id, p_operator_id]) as x
  ) < 4 then
    raise exception 'Ketua Tim, Pengendali Teknis, Pengendali Mutu, dan Operator harus 4 orang berbeda — satu orang tidak boleh merangkap lebih dari satu peran di dokumen yang sama.';
  end if;

  if not public.is_admin(v_actor) and exists (
    select 1 from public.users
    where id in (p_dalnis_id, p_dalmut_id, p_operator_id)
      and team_ketua_tim_id is distinct from p_ketua_tim_id
  ) then
    raise exception 'Pengendali Teknis, Pengendali Mutu, dan Operator harus anggota tim Ketua Tim yang dipilih.';
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

-- Kembalikan is_admin ke level luar (lihat poin 2 di header).
drop policy if exists storage_documents_select on storage.objects;
create policy storage_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_admin(auth.uid())
      or exists (
        select 1 from public.documents d
        where d.id = (storage.foldername(name))[1]::uuid
          and (
            (d.status = 'finalized' and d.ketua_tim_id = public.my_team_id(auth.uid()))
            or public.is_assigned_to_document(auth.uid(), d.id)
          )
      )
    )
  );
