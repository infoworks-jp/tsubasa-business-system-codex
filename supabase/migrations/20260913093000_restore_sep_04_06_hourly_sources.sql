begin;

insert into rev2.documents (
  source_key, document_type, file_name, business_date,
  verification_status, ocr_status, library_file_id, sha256, byte_size, retention_status
)
select 'library:' || business_date || ':hourly_daily:' || file_name,
       'journal_hourly_daily', file_name, business_date,
       verification_status, ocr_status, library_file_id, sha256, byte_size, retention_status
from rev2.documents
where business_date between date '2026-09-02' and date '2026-09-06'
  and document_type = 'journal_product_daily'
on conflict (source_key) do update
set library_file_id = excluded.library_file_id,
    sha256 = excluded.sha256,
    byte_size = excluded.byte_size,
    retention_status = excluded.retention_status,
    verification_status = excluded.verification_status,
    ocr_status = excluded.ocr_status;

with source_rows (business_date, hour_start, quantity, gross_sales) as (
  values
    ('2026-09-04'::date,0,30,31660),('2026-09-04',1,8,7100),('2026-09-04',2,4,3600),
    ('2026-09-04',3,0,0),('2026-09-04',4,0,0),('2026-09-04',5,0,0),
    ('2026-09-04',6,0,0),('2026-09-04',7,0,0),('2026-09-04',8,0,0),
    ('2026-09-04',9,0,0),('2026-09-04',10,11,8900),('2026-09-04',11,14,13500),
    ('2026-09-04',12,16,17200),('2026-09-04',13,22,22260),('2026-09-04',14,4,5050),
    ('2026-09-04',15,0,0),('2026-09-04',16,0,0),('2026-09-04',17,9,10350),
    ('2026-09-04',18,12,11510),('2026-09-04',19,15,13980),('2026-09-04',20,27,27210),
    ('2026-09-04',21,32,31580),('2026-09-04',22,33,27630),('2026-09-04',23,24,27880),
    ('2026-09-05',0,21,16610),('2026-09-05',1,18,19810),('2026-09-05',2,2,1130),
    ('2026-09-05',3,0,0),('2026-09-05',4,0,0),('2026-09-05',5,0,0),
    ('2026-09-05',6,0,0),('2026-09-05',7,0,0),('2026-09-05',8,0,0),
    ('2026-09-05',9,0,0),('2026-09-05',10,4,4600),('2026-09-05',11,16,12990),
    ('2026-09-05',12,2,2080),('2026-09-05',13,11,15480),('2026-09-05',14,7,8080),
    ('2026-09-05',15,0,0),('2026-09-05',16,5,5100),('2026-09-05',17,7,7100),
    ('2026-09-05',18,6,6700),('2026-09-05',19,10,8680),('2026-09-05',20,9,10000),
    ('2026-09-05',21,25,25810),('2026-09-05',22,34,34680),('2026-09-05',23,34,33710),
    ('2026-09-06',0,31,27450),('2026-09-06',1,19,16930),('2026-09-06',2,2,1130),
    ('2026-09-06',3,0,0),('2026-09-06',4,0,0),('2026-09-06',5,0,0),
    ('2026-09-06',6,0,0),('2026-09-06',7,0,0),('2026-09-06',8,0,0),
    ('2026-09-06',9,0,0),('2026-09-06',10,0,0),('2026-09-06',11,4,6080),
    ('2026-09-06',12,13,14000),('2026-09-06',13,4,3650),('2026-09-06',14,2,2550),
    ('2026-09-06',15,2,2300),('2026-09-06',16,4,4900),('2026-09-06',17,9,7180),
    ('2026-09-06',18,17,13260),('2026-09-06',19,22,20210),('2026-09-06',20,34,32430),
    ('2026-09-06',21,30,31610),('2026-09-06',22,34,32740),('2026-09-06',23,23,23090)
)
update rev2.journal_hours jh
set quantity = s.quantity,
    gross_sales = s.gross_sales,
    sales_amount = s.gross_sales,
    source_document = 'daily_original_verified:' || d.file_name
from source_rows s
join rev2.daily_journal dj on dj.business_date = s.business_date
join rev2.documents d on d.business_date = s.business_date
  and d.document_type = 'journal_hourly_daily'
  and d.retention_status = 'preserved'
where jh.daily_journal_id = dj.id
  and jh.hour_start = s.hour_start;

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
    where dj.business_date between date '2026-09-04' and date '2026-09-06'
    group by dj.id, dj.business_date, dj.sales_total, dj.settlement_amount
    having count(jh.id) <> 24
       or sum(jh.sales_amount) - coalesce(dj.settlement_amount, 0) <> dj.sales_total
  ) failures;

  if bad_dates is not null then
    raise exception '9月時間帯原票の24時間・精算後検算に失敗: %', bad_dates;
  end if;
end;
$$;

commit;
