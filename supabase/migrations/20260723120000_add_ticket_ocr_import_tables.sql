begin;
create extension if not exists pgcrypto;

create table if not exists public.ticket_ocr_imports (
	id uuid primary key default gen_random_uuid(),
	image_name text not null,
	engine_id text not null,
	ocr_state text not null check (ocr_state in ('not-run', 'success', 'failed')),
	queue_status text not null default 'new' check (queue_status in ('new')),
	business_date date not null default current_date,
	total_count integer not null default 0,
	processed_count integer not null default 0,
	needs_review_count integer not null default 0,
	error_message text,
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

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'public'
			and tablename = 'ticket_ocr_imports'
			and policyname = 'ticket_ocr_imports_select_app'
	) then
		create policy ticket_ocr_imports_select_app
			on public.ticket_ocr_imports
			for select
			using (auth.role() in ('authenticated', 'anon'));
	end if;
end
$$;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'public'
			and tablename = 'ticket_ocr_imports'
			and policyname = 'ticket_ocr_imports_insert_app'
	) then
		create policy ticket_ocr_imports_insert_app
			on public.ticket_ocr_imports
			for insert
			with check (auth.role() in ('authenticated', 'anon'));
	end if;
end
$$;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'public'
			and tablename = 'ticket_ocr_import_rows'
			and policyname = 'ticket_ocr_import_rows_select_app'
	) then
		create policy ticket_ocr_import_rows_select_app
			on public.ticket_ocr_import_rows
			for select
			using (auth.role() in ('authenticated', 'anon'));
	end if;
end
$$;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'public'
			and tablename = 'ticket_ocr_import_rows'
			and policyname = 'ticket_ocr_import_rows_insert_app'
	) then
		create policy ticket_ocr_import_rows_insert_app
			on public.ticket_ocr_import_rows
			for insert
			with check (auth.role() in ('authenticated', 'anon'));
	end if;
end
$$;
commit;
