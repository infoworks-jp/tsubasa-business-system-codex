begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tsubasa-source-originals',
  'tsubasa-source-originals',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.ticket_ocr_imports
  add column if not exists source_document_id uuid references rev2.documents(id),
  add column if not exists source_sha256 text;

alter table public.ticket_ocr_imports
  drop constraint if exists ticket_ocr_imports_source_sha256_check,
  add constraint ticket_ocr_imports_source_sha256_check
    check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$');

create index if not exists ticket_ocr_imports_source_document_idx
  on public.ticket_ocr_imports (source_document_id);

alter table rev2.documents
  add column if not exists archive_uri text,
  add column if not exists library_file_id text,
  add column if not exists sha256 text,
  add column if not exists byte_size bigint,
  add column if not exists retention_status text not null default 'missing';

alter table rev2.documents
  drop constraint if exists documents_retention_status_check,
  add constraint documents_retention_status_check
    check (retention_status in ('preserved', 'metadata_only', 'missing')),
  drop constraint if exists documents_sha256_format_check,
  add constraint documents_sha256_format_check
    check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  drop constraint if exists documents_byte_size_check,
  add constraint documents_byte_size_check
    check (byte_size is null or byte_size > 0);

create index if not exists documents_sha256_idx on rev2.documents (sha256);
create index if not exists documents_retention_date_idx
  on rev2.documents (business_date, retention_status, document_type);

update rev2.documents
set library_file_id = case file_name
      when '7A107861-B534-4C93-A2A1-8741A68A9B5C_1_102_a.jpeg' then 'libfile_c0ecfb66afcc8191b25933ca19637c25'
      when 'A9CEF026-FFC2-420A-B26C-C9618A51302C_1_102_a.jpeg' then 'libfile_f5b48a1d2338819190da1a0524b0afda'
      when 'B46244C3-9349-4C60-A937-5456C245864B_1_201_a.jpeg' then 'libfile_39ea11ede6dc81918175786ca12bda6e'
      when '7E60C5DF-58C5-4729-A306-9FADFEA21376_1_201_a.jpeg' then 'libfile_778fd1f3b6808191bceb62c4fd634d3f'
    end,
    sha256 = case file_name
      when '7A107861-B534-4C93-A2A1-8741A68A9B5C_1_102_a.jpeg' then '625f2fd20c93ed7da9d81086f31b0add3e3fac27e29493d95b36ef33a6529470'
      when 'A9CEF026-FFC2-420A-B26C-C9618A51302C_1_102_a.jpeg' then 'b5baa54417f3e8062feac26f0cf022c93406d872fb748d7e75d2d4ea3ef2ef3f'
      when 'B46244C3-9349-4C60-A937-5456C245864B_1_201_a.jpeg' then '11fdad6448116134c45fd8fef29e0b605e649215161130f2ef7548370cdf447a'
      when '7E60C5DF-58C5-4729-A306-9FADFEA21376_1_201_a.jpeg' then 'a56272aa120542dd1564c9b4413381bfbcb68d1d0844fa1709e577b3e96f0794'
    end,
    byte_size = case file_name
      when '7A107861-B534-4C93-A2A1-8741A68A9B5C_1_102_a.jpeg' then 359608
      when 'A9CEF026-FFC2-420A-B26C-C9618A51302C_1_102_a.jpeg' then 360520
      when 'B46244C3-9349-4C60-A937-5456C245864B_1_201_a.jpeg' then 431488
      when '7E60C5DF-58C5-4729-A306-9FADFEA21376_1_201_a.jpeg' then 400900
    end,
    retention_status = 'preserved'
where file_name in (
  '7A107861-B534-4C93-A2A1-8741A68A9B5C_1_102_a.jpeg',
  'A9CEF026-FFC2-420A-B26C-C9618A51302C_1_102_a.jpeg',
  'B46244C3-9349-4C60-A937-5456C245864B_1_201_a.jpeg',
  '7E60C5DF-58C5-4729-A306-9FADFEA21376_1_201_a.jpeg'
);

create or replace function rev2.require_preserved_document_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.document_type like 'journal_%'
     and new.verification_status in ('verified_from_original', 'verified', '原本確認済み')
     and (
       new.retention_status <> 'preserved'
       or new.sha256 is null
       or new.byte_size is null
       or (new.archive_uri is null and new.library_file_id is null)
     )
  then
    raise exception '原本未保存: 検証済みジャーナルには保存先・SHA-256・容量が必要です';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_require_preserved_source on rev2.documents;
create trigger documents_require_preserved_source
before insert or update on rev2.documents
for each row execute function rev2.require_preserved_document_source();

create or replace function rev2.require_source_before_ocr_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.queue_status in ('confirmed', 'saved')
     and (
       new.source_document_id is null
       or new.source_sha256 is null
       or not exists (
         select 1 from rev2.documents d
         where d.id = new.source_document_id
           and d.retention_status = 'preserved'
           and d.sha256 = new.source_sha256
           and d.byte_size > 0
           and d.archive_uri is not null
       )
     )
  then
    raise exception '原本未保存: OCR取込の確認・登録はできません';
  end if;
  return new;
end;
$$;

drop trigger if exists ocr_confirmation_requires_source on public.ticket_ocr_imports;
create trigger ocr_confirmation_requires_source
before insert or update of queue_status on public.ticket_ocr_imports
for each row execute function rev2.require_source_before_ocr_confirmation();

create or replace function rev2.require_source_before_daily_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'confirmed'
     and new.business_date >= date '2026-09-13'
     and not exists (
       select 1
       from rev2.documents d
       where d.business_date = new.business_date
         and d.document_type like 'journal_%'
         and d.retention_status = 'preserved'
         and d.sha256 is not null
         and d.byte_size is not null
         and (d.archive_uri is not null or d.library_file_id is not null)
     )
  then
    raise exception '原本未保存: 日計を確定する前に券売機写真を永久保存してください';
  end if;
  return new;
end;
$$;

drop trigger if exists daily_insert_requires_source on rev2.daily_journal;
create trigger daily_insert_requires_source
before insert on rev2.daily_journal
for each row execute function rev2.require_source_before_daily_confirmation();

drop trigger if exists daily_confirm_requires_source on rev2.daily_journal;
create trigger daily_confirm_requires_source
before update of status on rev2.daily_journal
for each row
when (old.status is distinct from new.status)
execute function rev2.require_source_before_daily_confirmation();

create or replace function rev2.require_source_before_detail_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_date date;
  required_type text;
begin
  select d.business_date into source_date
  from rev2.daily_journal d
  where d.id = new.daily_journal_id;

  required_type := case tg_table_name
    when 'journal_products' then 'journal_product_daily'
    when 'journal_hours' then 'journal_hourly_daily'
    else 'journal_source_original'
  end;

  if not exists (
    select 1
    from rev2.documents doc
    where doc.business_date = source_date
      and doc.document_type in (required_type, 'journal_source_original')
      and doc.retention_status = 'preserved'
      and doc.sha256 is not null
      and doc.byte_size is not null
      and (doc.archive_uri is not null or doc.library_file_id is not null)
  )
  then
    raise exception '原本未保存: % の明細登録には保存済み原本が必要です', source_date;
  end if;
  return new;
end;
$$;

drop trigger if exists product_insert_requires_source on rev2.journal_products;
create trigger product_insert_requires_source
before insert on rev2.journal_products
for each row execute function rev2.require_source_before_detail_insert();

drop trigger if exists hourly_insert_requires_source on rev2.journal_hours;
create trigger hourly_insert_requires_source
before insert on rev2.journal_hours
for each row execute function rev2.require_source_before_detail_insert();

revoke all on function rev2.require_preserved_document_source() from public;
revoke all on function rev2.require_source_before_ocr_confirmation() from public;
revoke all on function rev2.require_source_before_daily_confirmation() from public;
revoke all on function rev2.require_source_before_detail_insert() from public;

commit;
