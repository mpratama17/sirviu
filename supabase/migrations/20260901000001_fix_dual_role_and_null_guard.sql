-- SIRVIU — 20260901000001_fix_dual_role_and_null_guard
--
-- Dua temuan dari close-out /code-review setelah PR admin-manage-teams.
-- Keduanya perbaikan LOGIKA saja (tidak ada perubahan skema, tidak ada
-- perubahan signature) — aman diterapkan sebelum atau sesudah deploy.
--
-- 1. `assign_team_member` (...000003) mengecek `is_admin(v_actor)` SEBELUM
--    `ketua_tim`. Efeknya: user dual-role (admin DAN ketua_tim — didukung
--    eksplisit di AGENTS.md) tidak pernah bisa mengelola timnya SENDIRI
--    lewat /team, karena halaman itu memanggil tanpa p_ketua_tim_id, dan
--    cabang admin mewajibkan parameter itu non-null. Fix: cabang berdasar
--    ADA/TIDAKNYA p_ketua_tim_id, bukan berdasar role actor duluan — ada
--    parameter -> jalur admin (masih digerbang is_admin di dalamnya); tidak
--    ada parameter -> jalur self-service (masih digerbang ketua_tim aktif).
--    Actor dual-role yang memanggil dari /team (tanpa parameter) sekarang
--    jatuh ke jalur self-service seperti seharusnya; panggilan dari panel
--    admin (dengan parameter) tetap jalur admin seperti sebelumnya — tidak
--    ada pelonggaran keamanan, cuma urutan pengecekan yang diperbaiki.
--
-- 2. `create_document` (...000002) pakai `p_ketua_tim_id <> v_actor`
--    (NULL-unsafe) untuk guard kepemilikan non-admin. Kalau p_ketua_tim_id
--    NULL, ekspresi itu jadi NULL (bukan TRUE) di PL/pgSQL sehingga
--    exception TIDAK raise — saat ini tertutupi kebetulan oleh check
--    distinct-4-id di baris berikutnya (NULL selalu bikin count < 4), tapi
--    guard-nya sendiri rapuh dan cuma aman karena urutan check di
--    bawahnya. Fix: `is distinct from`, konsisten dengan guard lain di
--    fungsi yang sama (`team_ketua_tim_id is distinct from p_ketua_tim_id`).

drop function if exists public.assign_team_member(uuid, uuid);

create function public.assign_team_member(
  p_member_id uuid,
  p_ketua_tim_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_team uuid;
  v_current_team uuid;
begin
  if v_actor is null then
    raise exception 'Harus login untuk mengatur anggota tim.';
  end if;

  if p_ketua_tim_id is not null then
    -- Tim tujuan ditentukan lewat parameter -> cuma admin yang boleh.
    if not public.is_admin(v_actor) then
      raise exception 'Hanya admin yang boleh menentukan tim tujuan secara eksplisit.';
    end if;
    if not exists (
      select 1 from public.users
      where id = p_ketua_tim_id and 'ketua_tim' = any(roles)
    ) then
      raise exception 'Tim tujuan bukan Ketua Tim.';
    end if;
    v_team := p_ketua_tim_id;
  else
    -- Tanpa parameter -> self-service, tim SELALU tim si pemanggil. Berlaku
    -- juga untuk actor yang kebetulan admin+ketua_tim sekaligus: karena
    -- p_ketua_tim_id null (dipanggil dari /team, bukan panel admin), jalur
    -- ini yang dipakai, bukan jalur admin di atas.
    if not exists (
      select 1 from public.users
      where id = v_actor and 'ketua_tim' = any(roles) and is_active
    ) then
      raise exception 'Hanya Ketua Tim aktif yang boleh mengatur anggota tim.';
    end if;
    v_team := v_actor;
  end if;

  if p_member_id = v_team then
    raise exception 'Ketua Tim tidak bisa menjadi anggota timnya sendiri.';
  end if;

  select team_ketua_tim_id into v_current_team
  from public.users
  where id = p_member_id
    and is_active
    and (roles && array['dalnis', 'dalmut', 'operator']::text[])
    and not ('ketua_tim' = any(roles))
    and not ('admin' = any(roles))
  for update;

  if not found then
    raise exception 'User tidak ditemukan atau bukan Dalnis/Dalmut/Operator aktif.';
  end if;

  if v_current_team is not null and v_current_team <> v_team then
    raise exception 'User ini sudah menjadi anggota tim lain.';
  end if;

  update public.users set team_ketua_tim_id = v_team where id = p_member_id;
end;
$$;

grant execute on function public.assign_team_member(uuid, uuid) to authenticated;

-- Guard kepemilikan NULL-safe (lihat poin 2 di header) — sisanya identik
-- dengan versi ...000002.
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
