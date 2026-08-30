-- Trigger `enforce_user_update_columns` (migration ...000002) mem-block
-- SEMUA update kolom `roles` oleh non-admin — termasuk onboarding role
-- picker yang secara sengaja mengizinkan user memilih role pertama kali.
--
-- RPC `select_own_initial_role` (migration ...20260830000001) sudah punya
-- semua guard yang diperlukan (roles harus kosong, p_role in
-- 'ketua_tim'/'dalnis'/'dalmut'/'operator', pakai actor dari auth.uid()),
-- tapi trigger jalan lebih dulu dan menolak update. SECURITY DEFINER di
-- RPC tidak menolong karena trigger cek `auth.role()`/`auth.uid()`, bukan
-- role owner fungsi.
--
-- Fix: longgarkan trigger untuk kasus khusus SELF-ONBOARDING:
--   - user update baris SENDIRI (new.id = auth.uid())
--   - roles LAMA kosong (belum pernah onboarding)
--   - roles BARU tepat 1 element, non-admin
--   - is_active tidak berubah
-- Ini idempotent: begitu roles > 0, kondisi tidak match lagi. Admin
-- tetap satu-satunya jalur untuk mengubah roles setelah onboarding.

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
  end if;
  return new;
end;
$$;
