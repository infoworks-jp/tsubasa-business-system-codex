begin;

create extension if not exists pgcrypto;

create table if not exists public.ticket_ocr_imports (
  id uuid primary key default gen_random_uuid(),
  image_name text not null,
  engine_id text not null,
  ocr_state text not null check (ocr_state in ('not-run', 'success', 'failed')),
  total_count integer not null default 0,
  processed_count integer not null default 0,
  needs_review_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_ocr_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.ticket_ocr_imports(id) on delete cascade,
  row_no integer not null,
  product_name text not null,
  quantity integer not null default 0,
  amount integer not null default 0,
  time_slot text not null,
  product_id uuid references public.products(id),
  status text not null check (status in ('processed', 'needs-review')),
  review_reason text,
  created_at timestamptz not null default now()
);

create index if not exists ticket_ocr_import_rows_import_idx
  on public.ticket_ocr_import_rows(import_id, row_no);

alter table public.ticket_ocr_imports enable row level security;
alter table public.ticket_ocr_import_rows enable row level security;

create policy if not exists ticket_ocr_imports_select_admin
  on public.ticket_ocr_imports
  for select
  using (auth.role() = 'authenticated');

create policy if not exists ticket_ocr_imports_insert_admin
  on public.ticket_ocr_imports
  for insert
  with check (auth.role() = 'authenticated');

create policy if not exists ticket_ocr_import_rows_select_admin
  on public.ticket_ocr_import_rows
  for select
  using (auth.role() = 'authenticated');

create policy if not exists ticket_ocr_import_rows_insert_admin
  on public.ticket_ocr_import_rows
  for insert
  with check (auth.role() = 'authenticated');

commit;
