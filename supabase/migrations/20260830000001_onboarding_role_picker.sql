-- Onboarding: user baru habis login Google pertama kali harus pilih SATU
-- role (Ketua Tim / Pengendali Teknis / Pengendali Mutu / Operator) dari
-- halaman /onboarding/role. Admin sengaja tidak boleh dipilih sendiri —
-- harus di-assign super admin (Yogha) lewat /admin/users. Setelah dipilih,
-- role permanen (dari sisi user) — hanya admin yang boleh mengubah lagi
-- via updateUser di lib/actions/admin.ts.
--
-- Migration ini melakukan dua hal:
-- 1. Reset roles jadi kosong untuk akun test @sirviu.local — supaya kamu
--    bisa mencoba alur onboarding baru pakai akun test yang sudah ada.
--    yogha2002@gmail.com (super admin) sengaja tidak disentuh.
-- 2. RPC `select_own_initial_role` — dipanggil dari server action
--    `selectInitialRole` (lib/actions/profile.ts). Security definer supaya
--    bisa update public.users; actor_id diderive dari auth.uid() jadi tidak
--    bisa diforge caller. Guard "roles harus kosong" mencegah user
--    memanggil dua kali untuk self-privilege-escalation.

-- 1) Reset roles akun test
update public.users
set roles = '{}'
where email like '%@sirviu.local';

-- 2) RPC pemilihan role awal
create or replace function public.select_own_initial_role(p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_current_roles text[];
begin
  if v_actor is null then
    raise exception 'Sesi tidak valid.' using errcode = '28000';
  end if;

  -- p_role harus salah satu dari 4 role kerja. Admin dilarang self-select.
  if p_role not in ('ketua_tim', 'dalnis', 'dalmut', 'operator') then
    raise exception 'Role tidak valid.' using errcode = '22023';
  end if;

  select roles into v_current_roles
  from public.users
  where id = v_actor
  for update;

  if v_current_roles is null then
    raise exception 'Profil pengguna tidak ditemukan.' using errcode = 'P0002';
  end if;

  if array_length(v_current_roles, 1) is not null then
    raise exception 'Role sudah dipilih. Hubungi Admin bila ingin mengubah.'
      using errcode = 'P0001';
  end if;

  update public.users
  set roles = array[p_role]
  where id = v_actor;
end;
$$;

comment on function public.select_own_initial_role(text) is
  'Onboarding: user baru pilih SATU role dari 4 (bukan admin). '
  'One-shot — sekali dipanggil, panggilan berikutnya ditolak.';

grant execute on function public.select_own_initial_role(text) to authenticated;
