begin;

with source_rows (hour_start, quantity, gross_sales) as (
  values
    (0,20,20260),(1,6,6500),(2,8,5010),(3,0,0),(4,0,0),(5,0,0),
    (6,0,0),(7,0,0),(8,0,0),(9,0,0),(10,0,0),(11,15,14310),
    (12,21,22030),(13,7,7380),(14,6,6680),(15,8,8630),(16,4,3500),
    (17,20,18090),(18,3,3300),(19,11,12600),(20,14,13080),(21,31,29160),
    (22,41,45950),(23,23,22380)
)
update rev2.journal_hours jh
set quantity = s.quantity,
    gross_sales = s.gross_sales,
    sales_amount = s.gross_sales,
    source_document = 'daily_original_verified:F0BAE8A4-3B62-4745-861F-63514E1D2079.jpeg'
from source_rows s
join rev2.daily_journal dj on dj.business_date = date '2026-09-02'
where jh.daily_journal_id = dj.id
  and jh.hour_start = s.hour_start;

update rev2.daily_journal
set settlement_amount = 2800,
    notes = concat_ws(' / ', nullif(notes, ''), '原票再照合: 発行278,320円－精算2,800円＝日計275,520円')
where business_date = date '2026-09-07';

do $$
declare
  bad_dates text;
begin
  select string_agg(business_date::text, ', ' order by business_date)
  into bad_dates
  from (
    select dj.business_date
    from rev2.daily_journal dj
    join rev2.journal_hours jh on jh.daily_journal_id = dj.id
    where dj.business_date between date '2026-09-01' and date '2026-09-30'
      and dj.sales_total > 0
    group by dj.id, dj.business_date, dj.sales_total, dj.settlement_amount
    having count(jh.id) <> 24
       or sum(jh.sales_amount) - coalesce(dj.settlement_amount, 0) <> dj.sales_total
  ) failures;

  if bad_dates is not null then
    raise exception '9月時間帯発行額－精算額と日計の検算に失敗: %', bad_dates;
  end if;
end;
$$;

commit;
