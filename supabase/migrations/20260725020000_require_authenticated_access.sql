begin;

-- OCR import headers: authenticated only.
drop policy if exists ticket_ocr_imports_select_app on public.ticket_ocr_imports;
create policy ticket_ocr_imports_select_app
  on public.ticket_ocr_imports
  for select
  using (auth.role() = 'authenticated');

drop policy if exists ticket_ocr_imports_insert_app on public.ticket_ocr_imports;
create policy ticket_ocr_imports_insert_app
  on public.ticket_ocr_imports
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists ticket_ocr_imports_update_app on public.ticket_ocr_imports;
create policy ticket_ocr_imports_update_app
  on public.ticket_ocr_imports
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists ticket_ocr_imports_delete_app on public.ticket_ocr_imports;
create policy ticket_ocr_imports_delete_app
  on public.ticket_ocr_imports
  for delete
  using (auth.role() = 'authenticated');

-- OCR import rows: authenticated only.
drop policy if exists ticket_ocr_import_rows_select_app on public.ticket_ocr_import_rows;
create policy ticket_ocr_import_rows_select_app
  on public.ticket_ocr_import_rows
  for select
  using (auth.role() = 'authenticated');

drop policy if exists ticket_ocr_import_rows_insert_app on public.ticket_ocr_import_rows;
create policy ticket_ocr_import_rows_insert_app
  on public.ticket_ocr_import_rows
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists ticket_ocr_import_rows_update_app on public.ticket_ocr_import_rows;
create policy ticket_ocr_import_rows_update_app
  on public.ticket_ocr_import_rows
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists ticket_ocr_import_rows_delete_app on public.ticket_ocr_import_rows;
create policy ticket_ocr_import_rows_delete_app
  on public.ticket_ocr_import_rows
  for delete
  using (auth.role() = 'authenticated');

-- Sales totals: authenticated only.
drop policy if exists ticket_product_sales_totals_select_app on public.ticket_product_sales_totals;
create policy ticket_product_sales_totals_select_app
  on public.ticket_product_sales_totals
  for select
  using (auth.role() = 'authenticated');

-- Restrict table grants from anon and keep authenticated access.
revoke all on table public.ticket_ocr_imports from anon;
revoke all on table public.ticket_ocr_import_rows from anon;
revoke all on table public.ticket_product_sales_totals from anon;

grant select, insert, update, delete on table public.ticket_ocr_imports to authenticated;
grant select, insert, update, delete on table public.ticket_ocr_import_rows to authenticated;
grant select on table public.ticket_product_sales_totals to authenticated;

-- Product master access for authenticated users only.
revoke all on table public.products from anon;
revoke all on table public.product_prices from anon;
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.product_prices to authenticated;

-- RPC execution: authenticated only.
revoke execute on function public.rebuild_ticket_product_sales_totals() from anon;
grant execute on function public.rebuild_ticket_product_sales_totals() to authenticated;

revoke execute on function public.create_product_with_price(jsonb, text) from anon;
revoke execute on function public.update_product_with_price(uuid, jsonb, text, date) from anon;
grant execute on function public.create_product_with_price(jsonb, text) to authenticated;
grant execute on function public.update_product_with_price(uuid, jsonb, text, date) to authenticated;

commit;
