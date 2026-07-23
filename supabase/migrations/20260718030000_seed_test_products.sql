begin;

insert into public.products (
  product_code,
  product_name,
  category,
  ticket_button_number,
  ticket_display_position,
  sales_start_date,
  sales_end_date,
  standard_price,
  future_cost,
  is_active,
  deactivation_reason
) values
  (
    'TEST-MISO',
    'テスト味噌',
    'ラーメン',
    '1100',
    '1段目',
    '2026-07-18',
    null,
    1100,
    null,
    true,
    null
  ),
  (
    'TEST-BEER',
    'テスト生ビール',
    'ドリンク',
    '650',
    '2段目',
    '2026-07-18',
    null,
    650,
    null,
    true,
    null
  )
on conflict (product_code) do nothing;

insert into public.product_prices (product_id, price, valid_from, valid_to, change_reason)
select p.id, p.standard_price, p.sales_start_date, null, '初回登録'
from public.products p
where p.product_code in ('TEST-MISO', 'TEST-BEER')
on conflict do nothing;

commit;
