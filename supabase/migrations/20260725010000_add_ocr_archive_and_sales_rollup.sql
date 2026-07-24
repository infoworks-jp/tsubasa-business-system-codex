begin;

create extension if not exists pgcrypto;

alter table public.ticket_ocr_imports
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

create index if not exists ticket_ocr_imports_archived_at_idx
  on public.ticket_ocr_imports(archived_at);

alter table public.ticket_ocr_imports
  drop constraint if exists ticket_ocr_imports_queue_status_check;

alter table public.ticket_ocr_imports
  add constraint ticket_ocr_imports_queue_status_check
  check (queue_status in ('new', 'confirmed', 'needs-review', 'error', 'archived'));

create table if not exists public.ticket_product_sales_totals (
  id uuid primary key default gen_random_uuid(),
  business_date date not null,
  product_id uuid not null references public.products(id),
  quantity integer not null default 0 check (quantity >= 0),
  amount integer not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_product_sales_totals_unique unique (business_date, product_id)
);

create index if not exists ticket_product_sales_totals_business_date_idx
  on public.ticket_product_sales_totals(business_date);

alter table public.ticket_product_sales_totals enable row level security;

drop trigger if exists ticket_product_sales_totals_set_updated_at on public.ticket_product_sales_totals;
create trigger ticket_product_sales_totals_set_updated_at
before update on public.ticket_product_sales_totals
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_product_sales_totals'
      and policyname = 'ticket_product_sales_totals_select_app'
  ) then
    create policy ticket_product_sales_totals_select_app
      on public.ticket_product_sales_totals
      for select
      using (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

grant select on table public.ticket_product_sales_totals to anon, authenticated;

create or replace function public.rebuild_ticket_product_sales_totals()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ticket_product_sales_totals;

  insert into public.ticket_product_sales_totals (
    business_date,
    product_id,
    quantity,
    amount,
    created_at,
    updated_at
  )
  select
    i.business_date,
    r.product_id,
    sum(r.quantity)::integer as quantity,
    sum(r.amount)::integer as amount,
    now() as created_at,
    now() as updated_at
  from public.ticket_ocr_imports i
  join public.ticket_ocr_import_rows r
    on r.import_id = i.id
  where i.queue_status = 'confirmed'
    and i.archived_at is null
    and r.status = 'processed'
    and r.product_id is not null
  group by i.business_date, r.product_id;
end;
$$;

grant execute on function public.rebuild_ticket_product_sales_totals() to anon, authenticated;

select public.rebuild_ticket_product_sales_totals();

commit;
