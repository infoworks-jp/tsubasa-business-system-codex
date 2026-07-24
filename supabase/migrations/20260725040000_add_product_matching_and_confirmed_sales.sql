begin;

alter table public.ticket_ocr_import_rows
  add column if not exists original_product_name text,
  add column if not exists recorded_at timestamptz,
  add column if not exists effective_business_date date,
  add column if not exists sales_confirmed_at timestamptz,
  add column if not exists sales_confirmed_by uuid references auth.users(id),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text,
  add column if not exists match_change_reason text;

create or replace function public.resolve_jst_business_date(source_recorded_at timestamptz)
returns date language plpgsql immutable strict set search_path = public
as $$
declare
  local_recorded_at timestamp;
  local_date date;
begin
  local_recorded_at := source_recorded_at at time zone 'Asia/Tokyo';
  local_date := local_recorded_at::date;
  if extract(dow from local_recorded_at) = 1
    and extract(hour from local_recorded_at) < 4 then
    return local_date - 1;
  end if;
  return local_date;
end;
$$;

create or replace function public.preserve_ocr_original_and_business_date()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.original_product_name is null then
    new.original_product_name := new.product_name;
  end if;
  if tg_op = 'UPDATE'
    and old.original_product_name is not null
    and new.original_product_name is distinct from old.original_product_name then
    raise exception 'original_product_name is immutable';
  end if;
  if tg_op = 'UPDATE'
    and old.recorded_at is not null
    and new.recorded_at is distinct from old.recorded_at then
    raise exception 'recorded_at is immutable';
  end if;
  if new.recorded_at is not null then
    new.effective_business_date := public.resolve_jst_business_date(new.recorded_at);
  end if;
  return new;
end;
$$;

drop trigger if exists ticket_ocr_rows_preserve_original on public.ticket_ocr_import_rows;
create trigger ticket_ocr_rows_preserve_original
before insert or update on public.ticket_ocr_import_rows
for each row execute function public.preserve_ocr_original_and_business_date();

create table if not exists public.product_name_aliases (
  id uuid primary key default gen_random_uuid(),
  source_name text not null check (btrim(source_name) <> ''),
  normalized_name text not null check (btrim(normalized_name) <> ''),
  product_id uuid not null references public.products(id),
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null default auth.uid() references auth.users(id),
  archived_at timestamptz,
  archived_reason text
);
create unique index product_name_aliases_normalized_active_idx
  on public.product_name_aliases(normalized_name)
  where archived_at is null;

create table if not exists public.product_match_history (
  id uuid primary key default gen_random_uuid(),
  ocr_row_id uuid not null references public.ticket_ocr_import_rows(id),
  original_product_name text,
  previous_product_id uuid references public.products(id),
  new_product_id uuid references public.products(id),
  previous_status text,
  new_status text,
  previous_sales_confirmed_at timestamptz,
  new_sales_confirmed_at timestamptz,
  change_reason text not null check (btrim(change_reason) <> ''),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id)
);

create or replace function public.record_product_match_history()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.product_id is distinct from old.product_id
    or new.status is distinct from old.status
    or new.sales_confirmed_at is distinct from old.sales_confirmed_at then
    insert into public.product_match_history (
      ocr_row_id, original_product_name, previous_product_id, new_product_id,
      previous_status, new_status, previous_sales_confirmed_at,
      new_sales_confirmed_at, change_reason, changed_by
    ) values (
      new.id, coalesce(old.original_product_name, old.product_name),
      old.product_id, new.product_id, old.status, new.status,
      old.sales_confirmed_at, new.sales_confirmed_at,
      coalesce(nullif(btrim(new.match_change_reason), ''), '要確認'), auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists ticket_ocr_rows_match_history on public.ticket_ocr_import_rows;
create trigger ticket_ocr_rows_match_history
after update on public.ticket_ocr_import_rows
for each row execute function public.record_product_match_history();

alter table public.product_name_aliases enable row level security;
alter table public.product_match_history enable row level security;

create policy product_name_aliases_select_authenticated on public.product_name_aliases
  for select using (auth.role() = 'authenticated');
create policy product_name_aliases_insert_authenticated on public.product_name_aliases
  for insert with check (auth.role() = 'authenticated' and confirmed_by = auth.uid());
create policy product_name_aliases_update_authenticated on public.product_name_aliases
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy product_match_history_select_authenticated on public.product_match_history
  for select using (auth.role() = 'authenticated');

revoke all on table public.product_name_aliases from anon;
revoke all on table public.product_match_history from anon;
grant select, insert, update on table public.product_name_aliases to authenticated;
grant select on table public.product_match_history to authenticated;

create or replace view public.confirmed_product_sales_totals
with (security_invoker = true)
as
select
  coalesce(r.effective_business_date, i.business_date) as business_date,
  r.product_id,
  sum(r.quantity)::integer as quantity,
  sum(r.amount)::integer as amount
from public.ticket_ocr_imports i
join public.ticket_ocr_import_rows r on r.import_id = i.id
where i.queue_status = 'confirmed'
  and i.archived_at is null
  and r.archived_at is null
  and r.status = 'processed'
  and r.product_id is not null
  and r.sales_confirmed_at is not null
group by coalesce(r.effective_business_date, i.business_date), r.product_id;

revoke all on table public.confirmed_product_sales_totals from anon;
grant select on table public.confirmed_product_sales_totals to authenticated;

create or replace function public.rebuild_ticket_product_sales_totals()
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from public.ticket_product_sales_totals;
  insert into public.ticket_product_sales_totals (
    business_date, product_id, quantity, amount, created_at, updated_at
  )
  select business_date, product_id, quantity, amount, now(), now()
  from public.confirmed_product_sales_totals;
end;
$$;

revoke execute on function public.resolve_jst_business_date(timestamptz) from anon;
grant execute on function public.resolve_jst_business_date(timestamptz) to authenticated;

commit;
