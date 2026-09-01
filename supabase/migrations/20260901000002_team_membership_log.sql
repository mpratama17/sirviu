-- SIRVIU — 20260901000002_team_membership_log
--
-- Temuan close-out /code-review: assign_team_member/remove_team_member
-- (...000001, ...000003) tidak menulis audit trail apapun. Sejak
-- ...000001, team_ketua_tim_id BUKAN sekadar data organisasi — dia
-- menggerbang akses (my_team_id() dipakai di RLS visibility dokumen
-- finalized). Admin bisa memindah/mengeluarkan siapapun dari tim manapun
-- (...000003) tanpa jejak siapa/kapan/kenapa — persis kelas gap yang
-- sudah ditutup untuk override admin lain di codebase ini
-- (stage_transitions.is_admin_override, document_edit_log). Sama seperti
-- document_edit_log: dicatat terpisah, bukan ditambahkan ke
-- stage_transitions, karena bukan event alur dokumen.
--
-- Dicatat untuk SEMUA perubahan roster (self-service ketua_tim maupun
-- admin), bukan cuma yang lewat admin — biar linimasa satu anggota
-- lengkap. `actor_is_override` membedakan keduanya: true kalau actor
-- bertindak atas tim yang BUKAN timnya sendiri (v_team/v_current_team
-- <> v_actor) — hanya bisa terjadi lewat jalur admin, sama semantiknya
-- dengan stage_transitions.is_admin_override.
--
-- Belum ada UI yang menampilkan tabel ini (sama seperti document_edit_log
-- saat pertama dibuat) — datanya tercatat dan bisa di-query, surfacing ke
-- /admin/audit menyusul kalau dibutuhkan, bukan scope temuan ini.

create table public.team_membership_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id),
  actor_id uuid not null references public.users(id),
  action text not null check (action in ('assign', 'remove')),
  from_team_id uuid references public.users(id),
  to_team_id uuid references public.users(id),
  actor_is_override boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_team_membership_log_member on public.team_membership_log(member_id, created_at desc);

comment on table public.team_membership_log is
  'Append-only log tiap perubahan roster tim (assign/remove) lewat assign_team_member/remove_team_member. actor_is_override=true kalau actor bertindak atas tim yang bukan timnya sendiri (hanya mungkin lewat jalur admin) -- semantiknya sama dengan stage_transitions.is_admin_override.';

alter table public.team_membership_log enable row level security;

create policy team_membership_log_select on public.team_membership_log
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- INSERT hanya lewat assign_team_member/remove_team_member (security definer).

-- assign_team_member: signature tidak berubah dari ...000004, cuma
-- ditambah logging setelah update sukses.
create or replace function public.assign_team_member(
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

  insert into public.team_membership_log (
    member_id, actor_id, action, from_team_id, to_team_id, actor_is_override
  ) values (
    p_member_id, v_actor, 'assign', v_current_team, v_team, v_team is distinct from v_actor
  );
end;
$$;

grant execute on function public.assign_team_member(uuid, uuid) to authenticated;

-- remove_team_member: signature tidak berubah, ditambah logging. Perlu
-- ambil team_ketua_tim_id SEBELUM di-null-kan untuk from_team_id/override.
create or replace function public.remove_team_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_current_team uuid;
  v_count int;
begin
  if v_actor is null then
    raise exception 'Harus login untuk mengatur anggota tim.';
  end if;

  if public.is_admin(v_actor) then
    select team_ketua_tim_id into v_current_team
    from public.users where id = p_member_id;

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

    v_current_team := v_actor;

    update public.users
      set team_ketua_tim_id = null
      where id = p_member_id and team_ketua_tim_id = v_actor;
  end if;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'User ini bukan anggota tim yang bisa Anda ubah.';
  end if;

  insert into public.team_membership_log (
    member_id, actor_id, action, from_team_id, to_team_id, actor_is_override
  ) values (
    p_member_id, v_actor, 'remove', v_current_team, null, v_current_team is distinct from v_actor
  );
end;
$$;

grant execute on function public.remove_team_member(uuid) to authenticated;
