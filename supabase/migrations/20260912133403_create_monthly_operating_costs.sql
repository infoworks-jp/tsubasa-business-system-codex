create table if not exists rev2.monthly_operating_costs (
  id uuid primary key default gen_random_uuid(),
  month_start date not null,
  cost_type text not null check (cost_type in ('food','labor','rent','other')),
  vendor text not null,
  amount integer not null check (amount >= 0),
  verification_status text not null default 'confirmed',
  source_reference text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month_start, cost_type, vendor)
);

alter table rev2.monthly_operating_costs enable row level security;
create policy monthly_operating_costs_public_read on rev2.monthly_operating_costs
  for select to anon, authenticated using (true);
grant select on rev2.monthly_operating_costs to anon, authenticated;

insert into rev2.monthly_operating_costs
  (month_start, cost_type, vendor, amount, verification_status, source_reference, notes)
values
  ('2026-06-01','rent','北海道振興株式会社',288000,'confirmed','bank_transactions 2026-05-29 / 1-15','費用発生月へ計上。店舗家賃部分のみ'),
  ('2026-06-01','rent','株式会社エイシン',50112,'confirmed','bank_transactions 2026-05-29 / 1-13','翌月分家賃を費用発生月へ計上'),
  ('2026-07-01','rent','北海道振興株式会社',288000,'confirmed','bank_transactions 2026-06-30 / 5-12','費用発生月へ計上。店舗家賃部分のみ'),
  ('2026-07-01','rent','株式会社エイシン',50112,'confirmed','bank_transactions 2026-06-30 / 5-14','翌月分家賃を費用発生月へ計上'),
  ('2026-08-01','rent','北海道振興株式会社',288000,'confirmed','bank_transactions 2026-07-30 / 9-8','請求内訳の家賃288,000円。費用発生月へ計上'),
  ('2026-08-01','rent','株式会社エイシン',50112,'confirmed','bank_transactions 2026-07-30 / 9-10','翌月分家賃を費用発生月へ計上')
on conflict (month_start, cost_type, vendor) do update set
  amount = excluded.amount,
  verification_status = excluded.verification_status,
  source_reference = excluded.source_reference,
  notes = excluded.notes,
  updated_at = now();
