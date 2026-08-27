-- SIRVIU — 002_rls_policies
-- RLS untuk semua tabel + storage bucket `documents`.
-- Lihat CLAUDE_CODE_BRIEF.md §7. Helper functions security definer dipakai
-- untuk menghindari infinite recursion saat policy `documents`/`users`
-- perlu cek role admin (yang berarti query balik ke public.users).

-- ============================================================
-- Helper functions (security definer, search_path dikunci)
-- ============================================================
create function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users
    where id = p_user_id and 'admin' = any(roles)
  );
$$;

comment on function public.is_admin is
  'Security definer supaya query ke public.users di dalam fungsi ini tidak memicu ulang RLS policy pemanggilnya (hindari infinite recursion).';

create function public.is_assigned_to_document(p_user_id uuid, p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.documents
    where id = p_document_id
      and (
        submitter_id = p_user_id
        or ketua_tim_id = p_user_id
        or dalnis_id = p_user_id
        or dalmut_id = p_user_id
        or operator_id = p_user_id
      )
  );
$$;

-- ============================================================
-- public.users
-- ============================================================
alter table public.users enable row level security;

-- Semua authenticated user boleh lihat semua users (dibutuhkan untuk
-- dropdown assignment reviewer di form upload dokumen).
create policy users_select on public.users
  for select to authenticated
  using (true);

-- User boleh update row sendiri; admin boleh update siapa saja.
-- Kolom roles/is_active tetap dijaga terpisah lewat trigger di bawah —
-- RLS row-level tidak bisa membedakan kolom mana yang diubah.
create policy users_update on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()))
  with check (id = auth.uid() or public.is_admin(auth.uid()));

-- Insert hanya lewat trigger handle_new_user (jalan sebagai owner fungsi,
-- bypass RLS) atau server action dengan service role. Tidak ada policy
-- INSERT untuk authenticated → default deny.

create function public.enforce_user_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Hanya batasi request yang lewat client SDK sebagai role `authenticated`
  -- biasa. Service role (server actions dengan service role key), SQL
  -- editor/migration (tanpa JWT sama sekali, auth.role() null), dan akses
  -- superuser langsung TIDAK difilter di sini — itu sudah trusted context
  -- di luar client boundary (dan salah satunya jalan pintas satu-satunya
  -- untuk bootstrap admin pertama).
  if auth.role() = 'authenticated' and not public.is_admin(auth.uid()) then
    if new.roles is distinct from old.roles
       or new.is_active is distinct from old.is_active then
      raise exception 'Hanya admin yang boleh mengubah roles atau status aktif user.';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_user_update_columns_trigger
  before update on public.users
  for each row execute function public.enforce_user_update_columns();

-- ============================================================
-- public.documents
-- ============================================================
alter table public.documents enable row level security;

create policy documents_select on public.documents
  for select to authenticated
  using (
    status = 'finalized'
    or public.is_admin(auth.uid())
    or submitter_id = auth.uid()
    or ketua_tim_id = auth.uid()
    or dalnis_id = auth.uid()
    or dalmut_id = auth.uid()
    or operator_id = auth.uid()
  );

create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    submitter_id = auth.uid()
    and exists (
      select 1 from public.users
      where id = auth.uid() and 'ketua_tim' = any(roles)
    )
  );

-- UPDATE: tidak ada policy untuk authenticated → hanya server action
-- (service role, bypass RLS) yang boleh mutasi current_stage/status/dsb.
-- Ini disengaja (brief §7): state machine terlalu sensitif untuk dipercayakan ke client.

create policy documents_delete on public.documents
  for delete to authenticated
  using (
    submitter_id = auth.uid()
    and current_stage = 1
    and not exists (
      select 1 from public.stage_transitions st
      where st.document_id = documents.id and st.action <> 'submit'
    )
  );

-- ============================================================
-- public.document_versions — append-only
-- ============================================================
alter table public.document_versions enable row level security;

create policy document_versions_select on public.document_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and (
          d.status = 'finalized'
          or public.is_admin(auth.uid())
          or public.is_assigned_to_document(auth.uid(), d.id)
        )
    )
  );

-- INSERT/UPDATE/DELETE: tidak ada policy untuk authenticated → hanya
-- server action (service role) yang boleh menambah versi baru.

-- ============================================================
-- public.stage_transitions — append-only audit trail
-- ============================================================
alter table public.stage_transitions enable row level security;

create policy stage_transitions_select on public.stage_transitions
  for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = stage_transitions.document_id
        and (
          d.status = 'finalized'
          or public.is_admin(auth.uid())
          or public.is_assigned_to_document(auth.uid(), d.id)
        )
    )
  );

-- INSERT: hanya server action (service role). UPDATE hanya dipakai server
-- action untuk set is_superseded=true saat reject — tidak ada policy
-- client untuk keduanya, dan tidak pernah ada policy DELETE (append-only,
-- brief §6.6).

-- ============================================================
-- Storage bucket `documents`
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760, -- 10 MB, brief §6.4
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- Object path convention: {document_id}/v{version_number}/{original_filename}
-- (document_id adalah folder pertama → storage.foldername(name)[1]).

create policy storage_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_admin(auth.uid())
      or exists (
        select 1 from public.documents d
        where d.id = (storage.foldername(name))[1]::uuid
          and (d.status = 'finalized' or public.is_assigned_to_document(auth.uid(), d.id))
      )
    )
  );

-- INSERT/UPDATE/DELETE object: tidak ada policy client → semua upload
-- (initial, revisi, format fix) wajib lewat server action dengan service
-- role, supaya penamaan path & validasi MIME/size ditegakkan di server
-- (brief §6.4), bukan cuma di client.
