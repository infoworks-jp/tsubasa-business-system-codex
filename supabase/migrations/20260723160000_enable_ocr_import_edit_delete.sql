begin;

-- Enable operation phase: edit and delete on OCR import queue.
grant update, delete on table public.ticket_ocr_imports to anon, authenticated;
grant update, delete on table public.ticket_ocr_import_rows to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_ocr_imports'
      and policyname = 'ticket_ocr_imports_update_app'
  ) then
    create policy ticket_ocr_imports_update_app
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
      and tablename = 'ticket_ocr_imports'
      and policyname = 'ticket_ocr_imports_delete_app'
  ) then
    create policy ticket_ocr_imports_delete_app
      on public.ticket_ocr_imports
      for delete
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
      and policyname = 'ticket_ocr_import_rows_update_app'
  ) then
    create policy ticket_ocr_import_rows_update_app
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
      and tablename = 'ticket_ocr_import_rows'
      and policyname = 'ticket_ocr_import_rows_delete_app'
  ) then
    create policy ticket_ocr_import_rows_delete_app
      on public.ticket_ocr_import_rows
      for delete
      using (auth.role() in ('authenticated', 'anon'));
  end if;
end
$$;

commit;
