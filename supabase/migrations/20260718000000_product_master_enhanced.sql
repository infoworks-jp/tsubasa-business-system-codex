begin;

alter table public.products
  add column if not exists deactivation_reason text;

create or replace function public.create_product_with_price(
  product_data jsonb,
  initial_reason text
)
returns public.products
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_product public.products;
begin
  insert into public.products (
    product_code, product_name, category, ticket_button_number,
    ticket_display_position, sales_start_date, sales_end_date,
    standard_price, future_cost, is_active, deactivation_reason
  ) values (
    product_data->>'product_code',
    product_data->>'product_name',
    product_data->>'category',
    product_data->>'ticket_button_number',
    product_data->>'ticket_display_position',
    (product_data->>'sales_start_date')::date,
    nullif(product_data->>'sales_end_date', '')::date,
    (product_data->>'standard_price')::integer,
    nullif(product_data->>'future_cost', '')::integer,
    coalesce((product_data->>'is_active')::boolean, true),
    nullif(product_data->>'deactivation_reason', '')
  )
  returning * into created_product;

  insert into public.product_prices (
    product_id, price, valid_from, valid_to, change_reason
  ) values (
    created_product.id,
    created_product.standard_price,
    created_product.sales_start_date,
    null,
    initial_reason
  );

  return created_product;
end;
$$;

create or replace function public.update_product_with_price(
  target_product_id uuid,
  product_data jsonb,
  price_reason text,
  price_valid_from date
)
returns public.products
language plpgsql
security invoker
set search_path = public
as $$
declare
  previous_product public.products;
  updated_product public.products;
  current_price public.product_prices;
begin
  select * into previous_product
  from public.products
  where id = target_product_id
  for update;

  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  if previous_product.standard_price <> (product_data->>'standard_price')::integer
     and price_valid_from is null then
    raise exception 'price valid from is required' using errcode = '22023';
  end if;

  if previous_product.standard_price <> (product_data->>'standard_price')::integer then
    select * into current_price
    from public.product_prices
    where product_id = target_product_id
      and valid_to is null
    for update;

    if not found or price_valid_from <= current_price.valid_from then
      raise exception 'price valid from must be after current valid from'
        using errcode = '22023';
    end if;
  end if;

  update public.products set
    product_code = product_data->>'product_code',
    product_name = product_data->>'product_name',
    category = product_data->>'category',
    ticket_button_number = product_data->>'ticket_button_number',
    ticket_display_position = product_data->>'ticket_display_position',
    sales_start_date = (product_data->>'sales_start_date')::date,
    sales_end_date = nullif(product_data->>'sales_end_date', '')::date,
    standard_price = (product_data->>'standard_price')::integer,
    future_cost = nullif(product_data->>'future_cost', '')::integer,
    is_active = coalesce((product_data->>'is_active')::boolean, is_active),
    deactivation_reason = case
      when coalesce((product_data->>'is_active')::boolean, true) = true then null
      else nullif(product_data->>'deactivation_reason', '')
    end
  where id = target_product_id
  returning * into updated_product;

  if previous_product.standard_price <> updated_product.standard_price then
    update public.product_prices
    set valid_to = price_valid_from - 1
    where product_id = target_product_id
      and valid_to is null;

    insert into public.product_prices (
      product_id, price, valid_from, valid_to, change_reason
    ) values (
      target_product_id,
      updated_product.standard_price,
      price_valid_from,
      null,
      price_reason
    );
  end if;

  return updated_product;
end;
$$;

alter table public.products enable row level security;
alter table public.product_prices enable row level security;

create policy if not exists products_select_admin
  on public.products
  for select
  using (auth.role() = 'authenticated');

create policy if not exists products_insert_admin
  on public.products
  for insert
  with check (auth.role() = 'authenticated');

create policy if not exists products_update_admin
  on public.products
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy if not exists products_delete_admin
  on public.products
  for delete
  using (auth.role() = 'authenticated');

create policy if not exists product_prices_select_admin
  on public.product_prices
  for select
  using (auth.role() = 'authenticated');

create policy if not exists product_prices_insert_admin
  on public.product_prices
  for insert
  with check (auth.role() = 'authenticated');

create policy if not exists product_prices_update_admin
  on public.product_prices
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

commit;
