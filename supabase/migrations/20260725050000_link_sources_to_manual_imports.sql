begin;

create or replace function public.keep_source_import_link_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.ocr_import_id is not null
    and new.ocr_import_id is distinct from old.ocr_import_id then
    raise exception 'ocr_import_id is immutable after linking';
  end if;
  return new;
end;
$$;

drop trigger if exists source_files_keep_import_link on public.source_files;
create trigger source_files_keep_import_link
before update of ocr_import_id on public.source_files
for each row execute function public.keep_source_import_link_immutable();

grant update (ocr_import_id) on table public.source_files to authenticated;

create or replace function public.create_manual_import_for_source(
  target_source_id uuid,
  target_business_date date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_record public.source_files%rowtype;
  new_import_id uuid;
begin
  select *
    into source_record
  from public.source_files
  where id = target_source_id
    and archived_at is null
  for update;

  if not found then
    raise exception 'active source file not found';
  end if;
  if source_record.ocr_import_id is not null then
    return source_record.ocr_import_id;
  end if;

  insert into public.ticket_ocr_imports (
    image_name,
    engine_id,
    ocr_state,
    queue_status,
    business_date,
    total_count,
    processed_count,
    needs_review_count,
    error_message
  ) values (
    source_record.original_filename,
    'manual-entry',
    'not-run',
    'new',
    target_business_date,
    0,
    0,
    0,
    null
  )
  returning id into new_import_id;

  update public.source_files
  set ocr_import_id = new_import_id
  where id = target_source_id;

  return new_import_id;
end;
$$;

revoke execute on function public.create_manual_import_for_source(uuid, date) from anon;
grant execute on function public.create_manual_import_for_source(uuid, date) to authenticated;

commit;
