-- SIRVIU — 20260831000001_team_isolation
--
-- Masukan user setelah testing: aplikasi ini dipakai oleh BANYAK ketua tim
-- sekaligus, masing-masing dengan anggota (dalnis/dalmut/operator) sendiri.
-- Workspace antar tim tidak boleh campur — satu tim tidak boleh lihat
-- pekerjaan tim lain. Satu anggota (dalnis/dalmut/operator) hanya boleh
-- jadi bagian dari SATU tim ketua_tim (dikonfirmasi user, bukan many-to-many
-- — kalau nanti berubah, `team_ketua_tim_id` jadi tabel join terpisah).
--
-- Keanggotaan tim diatur SELF-SERVICE oleh ketua_tim sendiri (dikonfirmasi
-- user) lewat RPC assign_team_member/remove_team_member — bukan admin, dan
-- bukan field baru di admin/users. Ini sengaja terpisah dari `roles`: warna
-- role (dalnis/dalmut/operator/ketua_tim) tetap dipilih user sendiri saat
-- onboarding dan tidak berubah di sini (lihat AGENTS.md, migration ...000002
-- allow_onboarding_role_self_select) — assign_team_member HANYA menulis
-- kolom team_ketua_tim_id, tidak pernah roles.

alter table public.users
  add column team_ketua_tim_id uuid references public.users(id);

create index users_team_ketua_tim_id_idx on public.users(team_ketua_tim_id);

comment on column public.users.team_ketua_tim_id is
  'Tim (ketua_tim) tempat dalnis/dalmut/operator ini jadi anggota. Null = belum diassign ke tim manapun. Diisi lewat RPC assign_team_member, bukan lewat admin/users atau update langsung — lihat trigger enforce_user_update_columns.';

-- ============================================================
-- Helper: tim seorang user (dipakai RLS finalized-doc visibility)
-- ============================================================
create function public.my_team_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when exists (
      select 1 from public.users where id = p_user_id and 'ketua_tim' = any(roles)
    ) then p_user_id
    else (select team_ketua_tim_id from public.users where id = p_user_id)
  end;
$$;

comment on function public.my_team_id is
  'Tim seorang user: dirinya sendiri kalau dia ketua_tim, atau team_ketua_tim_id kalau anggota (dalnis/dalmut/operator). Null kalau belum diassign ke tim manapun.';

-- ============================================================
-- Self-service team membership — hanya ketua_tim aktif untuk timnya sendiri
-- ============================================================
create function public.assign_team_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_current_team uuid;
begin
  if v_actor is null then
    raise exception 'Harus login untuk mengatur anggota tim.';
  end if;

  if not exists (
    select 1 from public.users
    where id = v_actor and 'ketua_tim' = any(roles) and is_active
  ) then
    raise exception 'Hanya Ketua Tim aktif yang boleh mengatur anggota tim.';
  end if;

  if p_member_id = v_actor then
    raise exception 'Tidak bisa menambahkan diri sendiri sebagai anggota tim.';
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

  if v_current_team is not null and v_current_team <> v_actor then
    raise exception 'User ini sudah menjadi anggota tim lain.';
  end if;

  update public.users set team_ketua_tim_id = v_actor where id = p_member_id;
end;
$$;

grant execute on function public.assign_team_member to authenticated;

create function public.remove_team_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_count int;
begin
  if v_actor is null then
    raise exception 'Harus login untuk mengatur anggota tim.';
  end if;

  if not exists (
    select 1 from public.users
    where id = v_actor and 'ketua_tim' = any(roles) and is_active
  ) then
    raise exception 'Hanya Ketua Tim aktif yang boleh mengatur anggota tim.';
  end if;

  update public.users
    set team_ketua_tim_id = null
    where id = p_member_id and team_ketua_tim_id = v_actor;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'User ini bukan anggota tim Anda.';
  end if;
end;
$$;

grant execute on function public.remove_team_member to authenticated;

-- ============================================================
-- Tutup lubang: enforce_user_update_columns (migration ...000002) menjaga
-- roles/is_active dari update langsung non-admin, tapi belum menjaga
-- team_ketua_tim_id — tanpa ini siapapun bisa `update users set
-- team_ketua_tim_id = ...` di baris sendiri lewat client biasa (RLS
-- users_update mengizinkan `id = auth.uid()`), melewati semua guard di
-- assign_team_member (already-in-another-team check, dst).
--
-- Fix-nya BUKAN blanket block seperti roles — assign_team_member/
-- remove_team_member (security definer, bypass RLS layaknya RPC lain di
-- codebase ini) menulis ke baris ANGGOTA (new.id = p_member_id), bukan
-- baris ketua_tim yang jadi actor. RLS users_update sudah memastikan
-- non-admin CUMA bisa lewat plain client update untuk `id = auth.uid()` —
-- jadi begitu new.id <> auth.uid(), update itu pasti datang dari RPC
-- security-definer (satu-satunya jalur lain), aman diloloskan. Yang
-- diblok cuma kasus new.id = auth.uid() (percobaan self-service langsung).
create or replace function public.enforce_user_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin(auth.uid()) then
    if new.is_active is distinct from old.is_active then
      raise exception 'Hanya admin yang boleh mengubah status aktif user.';
    end if;

    if new.roles is distinct from old.roles then
      -- Self-onboarding: user pilih role pertama kali via
      -- select_own_initial_role. Diizinkan sekali per user.
      if new.id = auth.uid()
         and coalesce(array_length(old.roles, 1), 0) = 0
         and array_length(new.roles, 1) = 1
         and new.roles[1] in ('ketua_tim', 'dalnis', 'dalmut', 'operator')
      then
        return new;
      end if;

      raise exception 'Hanya admin yang boleh mengubah roles user.';
    end if;

    if new.team_ketua_tim_id is distinct from old.team_ketua_tim_id
       and new.id = auth.uid() then
      raise exception 'Tidak bisa mengubah keanggotaan tim sendiri secara langsung — gunakan menu Tim.';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- create_document — dalnis/dalmut/operator harus anggota tim ketua_tim
-- yang dipilih (kecuali actor admin, yang tetap boleh lintas tim — sama
-- seperti override pattern lain di AGENTS.md).
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

-- ============================================================
-- RLS — dokumen finalized sekarang hanya terlihat lintas tim untuk admin,
-- BUKAN semua authenticated user. Deviation eksplisit dari brief §6.5
-- (dulu "finalized visible to ALL"), lihat AGENTS.md.
-- ============================================================
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated
  using (
    (status = 'finalized' and ketua_tim_id = public.my_team_id(auth.uid()))
    or public.is_admin(auth.uid())
    or submitter_id = auth.uid()
    or ketua_tim_id = auth.uid()
    or dalnis_id = auth.uid()
    or dalmut_id = auth.uid()
    or operator_id = auth.uid()
  );

drop policy if exists document_versions_select on public.document_versions;
create policy document_versions_select on public.document_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and (
          (d.status = 'finalized' and d.ketua_tim_id = public.my_team_id(auth.uid()))
          or public.is_admin(auth.uid())
          or public.is_assigned_to_document(auth.uid(), d.id)
        )
    )
  );

drop policy if exists stage_transitions_select on public.stage_transitions;
create policy stage_transitions_select on public.stage_transitions
  for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = stage_transitions.document_id
        and (
          (d.status = 'finalized' and d.ketua_tim_id = public.my_team_id(auth.uid()))
          or public.is_admin(auth.uid())
          or public.is_assigned_to_document(auth.uid(), d.id)
        )
    )
  );

drop policy if exists storage_documents_select on storage.objects;
create policy storage_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.id = (storage.foldername(name))[1]::uuid
        and (
          (d.status = 'finalized' and d.ketua_tim_id = public.my_team_id(auth.uid()))
          or public.is_admin(auth.uid())
          or public.is_assigned_to_document(auth.uid(), d.id)
        )
    )
  );
