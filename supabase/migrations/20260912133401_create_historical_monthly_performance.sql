create table if not exists rev2.historical_monthly_performance (
  month_start date primary key,
  sales_total bigint not null check (sales_total >= 0),
  customer_count integer not null check (customer_count >= 0),
  average_spend numeric generated always as (
    case when customer_count > 0 then round(sales_total::numeric / customer_count) else null end
  ) stored,
  source_page integer not null check (source_page between 1 and 37),
  source_file text not null,
  verification_status text not null default 'verified_from_original',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table rev2.historical_monthly_performance enable row level security;
drop policy if exists historical_monthly_public_read on rev2.historical_monthly_performance;
create policy historical_monthly_public_read on rev2.historical_monthly_performance
  for select to anon, authenticated using (true);
grant usage on schema rev2 to anon, authenticated;
grant select on rev2.historical_monthly_performance to anon, authenticated;

insert into rev2.historical_monthly_performance
  (month_start, sales_total, customer_count, source_page, source_file, verification_status, notes)
values
  ('2023-08-01',7151300,6815,1,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2023-09-01',7365390,6856,2,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2023-10-01',6504053,6062,3,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2023-11-01',5281960,4875,4,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2023-12-01',6559240,6145,5,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2024-02-01',7563920,6894,6,'20260911105907212.pdf','verified_from_original','2024年1月原票なし'),
  ('2024-03-01',6622630,6252,7,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2024-04-01',4426650,4175,8,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2024-05-01',5699340,5257,9,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2024-06-01',7088040,6537,10,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2024-07-01',7569620,6348,11,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2024-08-01',8397080,7082,12,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2024-09-01',7775130,6522,13,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2024-10-01',6658810,5701,14,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2024-11-01',5965840,5124,15,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2024-12-01',7069710,6053,16,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-01-01',5860120,4917,17,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-02-01',7072722,5743,18,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-03-01',5733020,4859,19,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-04-01',3861770,3286,20,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-05-01',5757370,4920,21,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-06-01',6258160,5294,22,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-07-01',5888470,4991,23,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-08-01',6583086,5708,24,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-09-01',6272550,5402,25,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-10-01',5832540,5118,26,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-11-01',4865320,4236,27,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2025-12-01',6046760,5052,28,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2026-01-01',4659260,3867,29,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2026-02-01',6229990,5130,30,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2026-03-01',5256460,4379,31,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2026-04-01',3590555,2839,32,'20260911105907212.pdf','verified_from_original','月末累計欄'),
  ('2026-05-01',4749577,3640,34,'20260911105907212.pdf','verified_from_original','33頁は人件費表'),
  ('2026-06-01',5560344,3908,36,'20260911105907212.pdf','verified_from_original','長期原票系列。券売機確定系列とは別'),
  ('2026-07-01',5028262,3816,35,'20260911105907212.pdf','verified_from_original','長期原票系列。券売機確定系列とは別'),
  ('2026-08-01',5254100,4002,37,'20260911105907212.pdf','verified_from_original','長期原票系列。券売機確定系列とは別')
on conflict (month_start) do update set
  sales_total = excluded.sales_total,
  customer_count = excluded.customer_count,
  source_page = excluded.source_page,
  source_file = excluded.source_file,
  verification_status = excluded.verification_status,
  notes = excluded.notes,
  updated_at = now();
