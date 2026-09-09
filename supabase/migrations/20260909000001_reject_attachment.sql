-- Permintaan user setelah demo Jumat (2026-09-05): saat "Kembalikan
-- untuk Revisi", reviewer ingin bisa melampirkan file PDF hasil SCAN
-- dokumen fisik yang sudah dikoreksi manual (dicoret-coret tangan),
-- bukan cuma catatan teks.
--
-- Didiskusikan dulu sama user sebelum implementasi — keputusan desain:
-- file ini LAMPIRAN PELENGKAP, bukan versi dokumen resmi berikutnya
-- (KT tetap upload revisi resmi lewat alur upload_revision yang sudah
-- ada, jadi document_versions baru). Attachment scan ini cuma nempel
-- ke baris audit reject itu sendiri, konsisten dengan filosofi
-- stage_transitions sebagai append-only audit trail (AGENTS.md §6.6):
-- kolom baru, bukan tabel/entity baru — lampiran-nya 1:1 dengan aksi
-- reject yang menghasilkannya, tidak ada kasus banyak-lampiran per
-- reject di scope ini (YAGNI).
--
-- Opsional (tidak semua revisi butuh markup fisik), berlaku di semua
-- titik reject (stage 2->1, 3->2, 4->3) — satu RejectModal yang sama.

alter table public.stage_transitions
  add column attachment_path text,
  add column attachment_name text,
  add column attachment_size int,
  add column attachment_mime_type text;

comment on column public.stage_transitions.attachment_path is
  'Path storage (bucket documents) lampiran PDF hasil scan koreksi manual — opsional, cuma diisi utk action=reject. Bukan document_versions: ini lampiran pelengkap, bukan versi resmi dokumen.';

-- Signature reject_review berubah (nambah 4 parameter opsional) — WAJIB
-- drop dulu, bukan langsung create-or-replace. Kalau tidak, Postgres
-- anggap ini overload baru (beda jumlah parameter = beda identitas
-- fungsi), bikin DUA reject_review sekaligus dan panggilan lama (3
-- argumen) jadi ambiguous. Sama persis pelajaran dari
-- ...000003_admin_manage_teams.sql soal assign_team_member. DROP juga
-- menghapus grant execute-nya — wajib di-re-grant di bawah.
drop function public.reject_review(uuid, int, text);

create function public.reject_review(
  p_document_id uuid,
  p_target_stage int,
  p_comment text,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_attachment_size int default null,
  p_attachment_mime_type text default null
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
  v_from_stage int;
  v_new_status text;
  v_override boolean := false;
begin
  if v_actor is null then raise exception 'Harus login.'; end if;
  if trim(coalesce(p_comment, '')) = '' then
    raise exception 'Komentar wajib diisi.';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;

  if v_doc.status <> 'in_progress' then
    raise exception 'Dokumen tidak dalam status in_progress.';
  end if;

  if v_doc.current_stage = 2 then
    if v_doc.dalnis_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Pengendali Teknis dokumen ini yang boleh mengembalikan.';
      end if;
      v_override := true;
    end if;
    if p_target_stage <> 1 then
      raise exception 'Dari stage 2 hanya bisa kembali ke stage 1 (Ketua Tim).';
    end if;
  elsif v_doc.current_stage = 3 then
    if v_doc.dalmut_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Irban (Pengendali Mutu) dokumen ini yang boleh mengembalikan.';
      end if;
      v_override := true;
    end if;
    if p_target_stage <> 2 then
      raise exception 'Dari stage 3 hanya bisa kembali ke stage 2 (Pengendali Teknis).';
    end if;
  elsif v_doc.current_stage = 4 then
    if v_doc.operator_id <> v_actor then
      if not public.is_admin(v_actor) then
        raise exception 'Hanya Operator dokumen ini yang boleh mengembalikan.';
      end if;
      v_override := true;
    end if;
    if p_target_stage <> 3 then
      raise exception 'Dari stage 4 hanya bisa kembali ke stage 3 (Irban / Pengendali Mutu).';
    end if;
  else
    raise exception 'Kembalikan untuk revisi hanya berlaku di stage 2, 3, atau 4.';
  end if;

  v_from_stage := v_doc.current_stage;

  select id into v_version_id
    from public.document_versions
    where document_id = p_document_id
    order by version_number desc
    limit 1;

  -- Stage 1 (KT) satu-satunya upload stage — target selain itu (2/3)
  -- adalah reviewer, jadi status tetap `in_progress` (reviewer re-review
  -- versi yang sudah ada, tanpa perlu upload baru).
  if p_target_stage = 1 then
    v_new_status := 'revision_requested';
  else
    v_new_status := 'in_progress';
  end if;

  update public.documents
    set current_stage = p_target_stage,
        status = v_new_status,
        current_stage_started_at = now()
    where id = p_document_id
    returning * into v_doc;

  insert into public.stage_transitions (
    document_id, version_id, from_stage, to_stage, action, actor_id, comment,
    target_stage_on_reject, is_admin_override,
    attachment_path, attachment_name, attachment_size, attachment_mime_type
  ) values (
    p_document_id, v_version_id, v_from_stage, p_target_stage, 'reject', v_actor, p_comment,
    p_target_stage, v_override,
    p_attachment_path, p_attachment_name, p_attachment_size, p_attachment_mime_type
  );

  -- Supersede approvals di stage > target (reviewer di sana harus review
  -- ulang). from_stage NULL (baris pembuatan dokumen) TIDAK ke-supersede.
  update public.stage_transitions
    set is_superseded = true
    where document_id = p_document_id
      and to_stage > p_target_stage
      and action in ('approve', 'submit', 'revise_and_forward')
      and is_superseded = false;

  perform public._notify_stage_holder(v_doc);
  return v_doc;
end;
$$;

grant execute on function public.reject_review to authenticated;
