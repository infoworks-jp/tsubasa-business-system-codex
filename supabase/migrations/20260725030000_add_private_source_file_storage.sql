begin;

insert into storage.buckets (id, name, public)
values ('original-source-files', 'original-source-files', false)
on conflict (id) do update set public = false;

create table if not exists public.source_files (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text not null check (btrim(mime_type) <> ''),
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  stored_at timestamptz not null default now(),
  archived_at timestamptz,
  archive_reason text,
  ocr_import_id uuid references public.ticket_ocr_imports(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  constraint source_files_archive_reason_required check (
    (archived_at is null and archive_reason is null)
    or (archived_at is not null and btrim(coalesce(archive_reason, '')) <> '')
  )
);

create index if not exists source_files_stored_at_idx
  on public.source_files (stored_at desc);
create index if not exists source_files_ocr_import_id_idx
  on public.source_files (ocr_import_id);

alter table public.source_files enable row level security;

create policy source_files_select_authenticated on public.source_files
  for select using (auth.role() = 'authenticated');
create policy source_files_insert_authenticated on public.source_files
  for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());
create policy source_files_archive_authenticated on public.source_files
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated' and created_by = auth.uid());

revoke all on table public.source_files from anon;
revoke all on table public.source_files from authenticated;
grant select, insert on table public.source_files to authenticated;
grant update (archived_at, archive_reason) on table public.source_files to authenticated;

create policy original_source_files_select_authenticated on storage.objects
  for select using (
    bucket_id = 'original-source-files' and auth.role() = 'authenticated'
  );
create policy original_source_files_insert_authenticated on storage.objects
  for insert with check (
    bucket_id = 'original-source-files'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
