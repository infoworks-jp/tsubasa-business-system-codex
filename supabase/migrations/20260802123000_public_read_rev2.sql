grant usage on schema rev2 to anon;
grant select on all tables in schema rev2 to anon;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'daily_journal','journal_products','journal_hours','monthly_summary',
    'bank_transactions','expenses','payroll','documents','product_master'
  ]
  loop
    execute format('drop policy if exists public_read_rev2 on rev2.%I', table_name);
    execute format('create policy public_read_rev2 on rev2.%I for select to anon using (true)', table_name);
  end loop;
end $$;
