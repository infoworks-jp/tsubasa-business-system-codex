begin;

create schema if not exists rev2;

create table rev2.product_master (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  product_name text not null,
  category text not null,
  standard_price integer not null check (standard_price >= 0),
  is_active boolean not null default true,
  sales_start_date date,
  sales_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sales_end_date is null or sales_start_date is null or sales_end_date >= sales_start_date)
);

create table rev2.documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('journal','bank','expense','payroll','other')),
  original_filename text not null,
  storage_path text not null,
  sha256 text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  business_date date,
  ocr_status text not null default 'pending' check (ocr_status in ('pending','processing','succeeded','failed','not_required')),
  ocr_error text,
  created_at timestamptz not null default now()
);

create table rev2.daily_journal (
  id uuid primary key default gen_random_uuid(),
  business_date date not null unique,
  document_id uuid references rev2.documents(id),
  sales_total integer not null check (sales_total >= 0),
  customer_count integer check (customer_count is null or customer_count >= 0),
  status text not null default 'draft' check (status in ('draft','review','confirmed','rejected')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rev2.journal_products (
  id uuid primary key default gen_random_uuid(),
  daily_journal_id uuid not null references rev2.daily_journal(id) on delete restrict,
  product_id uuid not null references rev2.product_master(id) on delete restrict,
  quantity integer not null check (quantity >= 0),
  unit_price integer not null check (unit_price >= 0),
  sales_amount integer generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  unique (daily_journal_id, product_id, unit_price)
);

create table rev2.journal_hours (
  id uuid primary key default gen_random_uuid(),
  daily_journal_id uuid not null references rev2.daily_journal(id) on delete restrict,
  hour_start smallint not null check (hour_start between 0 and 23),
  quantity integer not null check (quantity >= 0),
  sales_amount integer not null check (sales_amount >= 0),
  created_at timestamptz not null default now(),
  unique (daily_journal_id, hour_start)
);

create table rev2.monthly_summary (
  id uuid primary key default gen_random_uuid(),
  month_start date not null unique check (month_start = date_trunc('month', month_start)::date),
  sales_total integer not null check (sales_total >= 0),
  product_sales_total integer not null check (product_sales_total >= 0),
  hour_sales_total integer not null check (hour_sales_total >= 0),
  business_days integer not null check (business_days >= 0),
  status text not null default 'draft' check (status in ('draft','verified','confirmed')),
  source_updated_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table rev2.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  document_id uuid references rev2.documents(id),
  description text not null,
  deposit_amount integer not null default 0 check (deposit_amount >= 0),
  withdrawal_amount integer not null default 0 check (withdrawal_amount >= 0),
  balance integer,
  matched_daily_journal_id uuid references rev2.daily_journal(id),
  match_status text not null default 'unmatched' check (match_status in ('unmatched','candidate','matched','review')),
  created_at timestamptz not null default now(),
  check (not (deposit_amount > 0 and withdrawal_amount > 0))
);

create table rev2.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  document_id uuid references rev2.documents(id),
  category text not null,
  description text not null,
  amount integer not null check (amount >= 0),
  payment_method text,
  created_at timestamptz not null default now()
);

create table rev2.payroll (
  id uuid primary key default gen_random_uuid(),
  payroll_month date not null check (payroll_month = date_trunc('month', payroll_month)::date),
  employee_ref text not null,
  gross_pay integer not null check (gross_pay >= 0),
  employer_cost integer not null check (employer_cost >= 0),
  document_id uuid references rev2.documents(id),
  created_at timestamptz not null default now(),
  unique (payroll_month, employee_ref)
);

create index daily_journal_business_date_idx on rev2.daily_journal (business_date);
create index journal_products_journal_idx on rev2.journal_products (daily_journal_id);
create index journal_products_product_idx on rev2.journal_products (product_id);
create index journal_hours_journal_idx on rev2.journal_hours (daily_journal_id);
create index bank_transactions_date_idx on rev2.bank_transactions (transaction_date);
create index expenses_date_idx on rev2.expenses (expense_date);
create index payroll_month_idx on rev2.payroll (payroll_month);

alter table rev2.product_master enable row level security;
alter table rev2.documents enable row level security;
alter table rev2.daily_journal enable row level security;
alter table rev2.journal_products enable row level security;
alter table rev2.journal_hours enable row level security;
alter table rev2.monthly_summary enable row level security;
alter table rev2.bank_transactions enable row level security;
alter table rev2.expenses enable row level security;
alter table rev2.payroll enable row level security;

commit;
