-- SIRVIU — 001_initial_schema
-- Skema inti: users, documents, document_versions, stage_transitions.
-- Lihat CLAUDE_CODE_BRIEF.md §4 untuk spesifikasi lengkap.

-- ============================================================
-- public.users — sync dengan auth.users
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  roles text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.users
  add constraint users_roles_valid check (
    roles <@ array['ketua_tim', 'dalnis', 'dalmut', 'operator', 'admin']::text[]
  );

comment on table public.users is 'Profil user, sync 1:1 dengan auth.users. roles adalah array — satu user bisa multi-role.';

-- Trigger: setiap kali ada signup baru di auth.users, buat row public.users.
-- name diambil dari raw_user_meta_data (Google OAuth mengisi 'full_name' atau 'name').
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- public.documents
-- ============================================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  nomor_surat_tugas text not null,
  nama_laporan text not null,
  submitter_id uuid not null references public.users(id),
  ketua_tim_id uuid not null references public.users(id),
  dalnis_id uuid not null references public.users(id),
  dalmut_id uuid not null references public.users(id),
  operator_id uuid not null references public.users(id),
  current_stage int not null default 1 check (current_stage between 1 and 7),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'revision_requested', 'finalized', 'cancelled')),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  current_stage_started_at timestamptz not null default now()
);

create index idx_documents_stage_status on public.documents(current_stage, status);
create index idx_documents_created on public.documents(created_at desc);

comment on table public.documents is 'Dokumen LHP dan state alur reviu berjenjangnya. current_stage/status hanya dimutasi via server actions.';

-- ============================================================
-- public.document_versions
-- ============================================================
create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number int not null,
  file_path text not null,
  file_name text not null,
  file_size int not null,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  uploaded_by uuid not null references public.users(id),
  uploaded_at timestamptz not null default now(),
  upload_notes text,
  unique(document_id, version_number)
);

create index idx_versions_doc on public.document_versions(document_id, version_number desc);

comment on table public.document_versions is 'Append-only. file_path adalah path relatif di storage bucket documents.';

-- ============================================================
-- public.stage_transitions — audit trail, append-only
-- ============================================================
create table public.stage_transitions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_id uuid references public.document_versions(id),
  from_stage int,
  to_stage int not null,
  action text not null
    check (action in ('submit', 'approve', 'reject', 'format_fix', 'finalize', 'upload_revision', 'cancel')),
  actor_id uuid not null references public.users(id),
  comment text,
  target_stage_on_reject int,
  is_superseded boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_transitions_doc on public.stage_transitions(document_id, created_at desc);

comment on table public.stage_transitions is 'Audit trail append-only. is_superseded ditandai (bukan dihapus) saat approval-nya direset oleh reject di atasnya.';
