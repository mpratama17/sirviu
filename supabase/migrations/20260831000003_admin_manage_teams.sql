-- SIRVIU — 20260831000003_admin_manage_teams
--
-- Admin = super admin (permintaan user eksplisit: "admin ini bisa semuanya").
-- Sampai sini roster tim murni self-service ketua_tim; sekarang admin juga
-- boleh melihat SEMUA tim beserta anggotanya (di /admin/users) dan mengubah
-- rosternya. Pola sama dengan admin override lain di AGENTS.md: guard
-- KEPEMILIKAN yang dilonggarkan, aturan lainnya TIDAK — satu orang tetap
-- cuma boleh di satu tim, anggota tetap harus dalnis/dalmut/operator aktif,
-- ketua_tim/admin tetap tidak bisa jadi anggota.
--
-- Tim di-derive dari ACTOR untuk non-admin, TIDAK PERNAH dari parameter —
-- itu persis pelajaran migration ...000002 (create_document dulu percaya
-- p_ketua_tim_id dari client, sehingga KT A bisa bekerja atas nama tim B).
-- `p_ketua_tim_id` di bawah cuma dibaca kalau actor-nya admin; untuk
-- ketua_tim biasa parameter itu DIABAIKAN, bukan divalidasi.
--
-- Param baru pakai `default null` supaya frontend lama (yang memanggil
-- dengan satu argumen bernama) tetap resolve — migration ini aman
-- diterapkan sebelum deploy.

-- Signature berubah (nambah parameter), jadi harus drop dulu: `create or
-- replace` dengan argumen berbeda bikin OVERLOAD, dan panggilan satu
-- argumen jadi ambigu.
drop function if exists public.assign_team_member(uuid);

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

  if public.is_admin(v_actor) then
    if p_ketua_tim_id is null then
      raise exception 'Tim tujuan wajib dipilih.';
    end if;
    if not exists (
      select 1 from public.users
      where id = p_ketua_tim_id and 'ketua_tim' = any(roles)
    ) then
      raise exception 'Tim tujuan bukan Ketua Tim.';
    end if;
    v_team := p_ketua_tim_id;
  else
    if not exists (
      select 1 from public.users
      where id = v_actor and 'ketua_tim' = any(roles) and is_active
    ) then
      raise exception 'Hanya Ketua Tim aktif yang boleh mengatur anggota tim.';
    end if;
    -- p_ketua_tim_id sengaja diabaikan: tim SELALU tim si pemanggil.
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

  -- Berlaku untuk admin juga: pindah tim = keluarkan dulu, baru tambahkan.
  -- Dua klik di panel yang sama, dan perpindahannya jadi eksplisit.
  if v_current_team is not null and v_current_team <> v_team then
    raise exception 'User ini sudah menjadi anggota tim lain.';
  end if;

  update public.users set team_ketua_tim_id = v_team where id = p_member_id;
end;
$$;

grant execute on function public.assign_team_member(uuid, uuid) to authenticated;

-- remove: signature tetap, tapi predikatnya perlu cabang admin. Tanpa itu
-- `where team_ketua_tim_id = v_actor` cocok NOL baris untuk admin (admin
-- tidak punya tim), lalu jatuh ke exception "bukan anggota tim Anda".
create or replace function public.remove_team_member(p_member_id uuid)
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

  if public.is_admin(v_actor) then
    update public.users
      set team_ketua_tim_id = null
      where id = p_member_id and team_ketua_tim_id is not null;
  else
    if not exists (
      select 1 from public.users
      where id = v_actor and 'ketua_tim' = any(roles) and is_active
    ) then
      raise exception 'Hanya Ketua Tim aktif yang boleh mengatur anggota tim.';
    end if;

    update public.users
      set team_ketua_tim_id = null
      where id = p_member_id and team_ketua_tim_id = v_actor;
  end if;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'User ini bukan anggota tim yang bisa Anda ubah.';
  end if;
end;
$$;

grant execute on function public.remove_team_member(uuid) to authenticated;
