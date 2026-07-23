begin;

-- Allow current app flow (unauthenticated browser) to read/write OCR import queue data.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_ocr_imports'
      and policyname = 'ticket_ocr_imports_select_anon'
  ) then
    create policy ticket_ocr_imports_select_anon
      on public.ticket_ocr_imports
      for select
      using (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_ocr_imports'
      and policyname = 'ticket_ocr_imports_insert_anon'
  ) then
    create policy ticket_ocr_imports_insert_anon
      on public.ticket_ocr_imports
      for insert
      with check (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_ocr_imports'
      and policyname = 'ticket_ocr_imports_update_anon'
  ) then
    create policy ticket_ocr_imports_update_anon
      on public.ticket_ocr_imports
      for update
      using (auth.role() in ('authenticated', 'anon'))
      with check (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_ocr_import_rows'
      and policyname = 'ticket_ocr_import_rows_select_anon'
  ) then
    create policy ticket_ocr_import_rows_select_anon
      on public.ticket_ocr_import_rows
      for select
      using (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_ocr_import_rows'
      and policyname = 'ticket_ocr_import_rows_insert_anon'
  ) then
    create policy ticket_ocr_import_rows_insert_anon
      on public.ticket_ocr_import_rows
      for insert
      with check (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_ocr_import_rows'
      and policyname = 'ticket_ocr_import_rows_update_anon'
  ) then
    create policy ticket_ocr_import_rows_update_anon
      on public.ticket_ocr_import_rows
      for update
      using (auth.role() in ('authenticated', 'anon'))
      with check (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_product_sales_totals'
      and policyname = 'ticket_product_sales_totals_select_anon'
  ) then
    create policy ticket_product_sales_totals_select_anon
      on public.ticket_product_sales_totals
      for select
      using (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_product_sales_totals'
      and policyname = 'ticket_product_sales_totals_insert_anon'
  ) then
    create policy ticket_product_sales_totals_insert_anon
      on public.ticket_product_sales_totals
      for insert
      with check (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_product_sales_totals'
      and policyname = 'ticket_product_sales_totals_update_anon'
  ) then
    create policy ticket_product_sales_totals_update_anon
      on public.ticket_product_sales_totals
      for update
      using (auth.role() in ('authenticated', 'anon'))
      with check (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

commit;
