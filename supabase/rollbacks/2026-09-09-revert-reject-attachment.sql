-- Rollback untuk 20260909000001_reject_attachment.sql
-- Balikin reject_review ke signature lama (3 param, tanpa attachment) dan
-- drop 4 kolom attachment_* dari stage_transitions.
--
-- CATATAN: kalau sudah ada baris reject dengan attachment_path terisi
-- (file lampiran sudah diupload ke storage), rollback ini MENGHAPUS
-- metadata-nya dari DB (kolom di-drop) tapi file di storage bucket
-- `documents` tetap ada sebagai orphan — hapus manual lewat Supabase
-- Storage dashboard kalau perlu, tidak otomatis oleh script ini.

drop function public.reject_review(uuid, int, text, text, text, int, text);

create function public.reject_review(
  p_document_id uuid,
  p_target_stage int,
  p_comment text
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
    document_id, version_id, from_stage, to_stage, action, actor_id, comment, target_stage_on_reject, is_admin_override
  ) values (
    p_document_id, v_version_id, v_from_stage, p_target_stage, 'reject', v_actor, p_comment, p_target_stage, v_override
  );

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

alter table public.stage_transitions
  drop column attachment_path,
  drop column attachment_name,
  drop column attachment_size,
  drop column attachment_mime_type;
