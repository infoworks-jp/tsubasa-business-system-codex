begin;

insert into rev2.documents (
  source_key, document_type, file_name, business_date,
  verification_status, ocr_status, library_file_id, sha256, byte_size, retention_status
)
values
  ('library:2026-09-02:product_daily:F0BAE8A4-3B62-4745-861F-63514E1D2079.jpeg', 'journal_product_daily', 'F0BAE8A4-3B62-4745-861F-63514E1D2079.jpeg', '2026-09-02', 'verified_from_original', 'manual_verified', 'libfile_788a5cc48744819197be3a73da8f5a5b', '3d488d9d70c2f24e45a1a4aa5d0cd8d7f4e2f1045ee9eb14c495d2a490688854', 319537, 'preserved'),
  ('library:2026-09-03:product_daily:1520140B-580E-445E-BECB-66FD79970899.jpeg', 'journal_product_daily', '1520140B-580E-445E-BECB-66FD79970899.jpeg', '2026-09-03', 'verified_from_original', 'manual_verified', 'libfile_e3bc1f60d1e08191838a514cdaeb15c1', '17157cd04f8b7bbce7ff62e762961469b9dcae96863061f3c42412141d2ca0ea', 320878, 'preserved'),
  ('library:2026-09-04:product_daily:3DC53A24-1901-431A-B158-ACFB3E32C686.jpeg', 'journal_product_daily', '3DC53A24-1901-431A-B158-ACFB3E32C686.jpeg', '2026-09-04', 'verified_from_original', 'manual_verified', 'libfile_62503d97d9888191a5b945ac1b519bf6', 'c05dec630f76e422b91ca32619d6a8bb5fe525f417a0cabae8b727261d8a4271', 307988, 'preserved'),
  ('library:2026-09-05:product_daily:IMG_E915E166-C90C-4FE7-87A4-E4D171A57F94.jpeg', 'journal_product_daily', 'IMG_E915E166-C90C-4FE7-87A4-E4D171A57F94.jpeg', '2026-09-05', 'verified_from_original', 'manual_verified', 'libfile_ea958f5f4c3081918e0cbe7570257ab6', '6b86c38249cbaa097cbfa40fe350d18977615a72399dec82d8b06dfe9b393e52', 322040, 'preserved'),
  ('library:2026-09-06:product_daily:9E85CF95-6C87-4D75-97E2-81D0B3992829.jpeg', 'journal_product_daily', '9E85CF95-6C87-4D75-97E2-81D0B3992829.jpeg', '2026-09-06', 'verified_from_original', 'manual_verified', 'libfile_90090d7a12108191b5f323a2b9e74293', 'a3cb99eeef480c25dfbc13f0d82cefd77519c9074dae9ad0e46185660e26ed02', 310258, 'preserved')
on conflict (source_key) do update
set library_file_id = excluded.library_file_id,
    sha256 = excluded.sha256,
    byte_size = excluded.byte_size,
    retention_status = excluded.retention_status,
    verification_status = excluded.verification_status,
    ocr_status = excluded.ocr_status;

with source_rows (business_date, product_code, issued_count, settlement_count) as (
  values
    ('2026-09-02'::date,'P001',90,0),('2026-09-02','P002',39,0),('2026-09-02','P003',2,0),('2026-09-02','P004',2,0),('2026-09-02','P005',8,0),('2026-09-02','P006',0,0),('2026-09-02','P007',4,0),('2026-09-02','P008',2,0),('2026-09-02','P009',2,0),('2026-09-02','P010',1,0),
    ('2026-09-02','P011',4,0),('2026-09-02','P012',0,0),('2026-09-02','P013',7,0),('2026-09-02','P014',0,0),('2026-09-02','P015',0,0),('2026-09-02','P016',1,0),('2026-09-02','P017',0,0),('2026-09-02','P018',0,0),('2026-09-02','P019',5,0),('2026-09-02','P020',0,0),
    ('2026-09-02','P021',0,0),('2026-09-02','P022',12,0),('2026-09-02','P023',0,0),('2026-09-02','P024',0,0),('2026-09-02','P025',2,0),('2026-09-02','P026',0,0),('2026-09-02','P027',0,0),('2026-09-02','P028',3,0),('2026-09-02','P029',1,0),('2026-09-02','P030',0,0),
    ('2026-09-02','P031',2,0),('2026-09-02','P032',8,0),('2026-09-02','P033',5,0),('2026-09-02','P034',10,0),('2026-09-02','P035',2,0),('2026-09-02','P036',6,0),('2026-09-02','P037',11,0),('2026-09-02','P038',0,0),('2026-09-02','P039',4,0),('2026-09-02','P040',5,0),
    ('2026-09-03','P001',88,-2),('2026-09-03','P002',41,0),('2026-09-03','P003',12,0),('2026-09-03','P004',4,0),('2026-09-03','P005',4,0),('2026-09-03','P006',2,0),('2026-09-03','P007',6,0),('2026-09-03','P008',1,0),('2026-09-03','P009',2,0),('2026-09-03','P010',0,0),
    ('2026-09-03','P011',3,0),('2026-09-03','P012',0,0),('2026-09-03','P013',10,0),('2026-09-03','P014',4,0),('2026-09-03','P015',0,0),('2026-09-03','P016',1,0),('2026-09-03','P017',1,0),('2026-09-03','P018',1,0),('2026-09-03','P019',9,0),('2026-09-03','P020',1,0),
    ('2026-09-03','P021',0,0),('2026-09-03','P022',14,0),('2026-09-03','P023',1,0),('2026-09-03','P024',5,0),('2026-09-03','P025',9,0),('2026-09-03','P026',1,0),('2026-09-03','P027',0,0),('2026-09-03','P028',0,0),('2026-09-03','P029',9,-1),('2026-09-03','P030',2,0),
    ('2026-09-03','P031',3,0),('2026-09-03','P032',9,0),('2026-09-03','P033',4,0),('2026-09-03','P034',15,-1),('2026-09-03','P035',0,0),('2026-09-03','P036',0,0),('2026-09-03','P037',18,0),('2026-09-03','P038',2,0),('2026-09-03','P039',3,0),('2026-09-03','P040',2,0),
    ('2026-09-04','P001',116,-1),('2026-09-04','P002',34,0),('2026-09-04','P003',3,0),('2026-09-04','P004',4,0),('2026-09-04','P005',3,0),('2026-09-04','P006',0,0),('2026-09-04','P007',3,0),('2026-09-04','P008',1,0),('2026-09-04','P009',0,0),('2026-09-04','P010',1,0),
    ('2026-09-04','P011',1,0),('2026-09-04','P012',0,0),('2026-09-04','P013',6,0),('2026-09-04','P014',0,0),('2026-09-04','P015',0,0),('2026-09-04','P016',1,0),('2026-09-04','P017',0,0),('2026-09-04','P018',0,0),('2026-09-04','P019',4,0),('2026-09-04','P020',0,0),
    ('2026-09-04','P021',0,0),('2026-09-04','P022',10,0),('2026-09-04','P023',0,0),('2026-09-04','P024',2,0),('2026-09-04','P025',0,0),('2026-09-04','P026',0,0),('2026-09-04','P027',0,0),('2026-09-04','P028',0,0),('2026-09-04','P029',5,0),('2026-09-04','P030',1,0),
    ('2026-09-04','P031',4,0),('2026-09-04','P032',4,0),('2026-09-04','P033',3,0),('2026-09-04','P034',13,-1),('2026-09-04','P035',3,0),('2026-09-04','P036',6,0),('2026-09-04','P037',24,0),('2026-09-04','P038',0,0),('2026-09-04','P039',3,0),('2026-09-04','P040',6,0),
    ('2026-09-05','P001',85,0),('2026-09-05','P002',14,0),('2026-09-05','P003',4,0),('2026-09-05','P004',4,0),('2026-09-05','P005',3,0),('2026-09-05','P006',1,0),('2026-09-05','P007',9,0),('2026-09-05','P008',1,0),('2026-09-05','P009',3,0),('2026-09-05','P010',3,0),
    ('2026-09-05','P011',1,0),('2026-09-05','P012',0,0),('2026-09-05','P013',3,0),('2026-09-05','P014',0,0),('2026-09-05','P015',1,0),('2026-09-05','P016',0,0),('2026-09-05','P017',0,0),('2026-09-05','P018',1,0),('2026-09-05','P019',4,0),('2026-09-05','P020',0,0),
    ('2026-09-05','P021',0,0),('2026-09-05','P022',4,0),('2026-09-05','P023',1,0),('2026-09-05','P024',3,0),('2026-09-05','P025',3,0),('2026-09-05','P026',0,0),('2026-09-05','P027',4,0),('2026-09-05','P028',2,0),('2026-09-05','P029',4,0),('2026-09-05','P030',1,0),
    ('2026-09-05','P031',0,0),('2026-09-05','P032',7,0),('2026-09-05','P033',7,0),('2026-09-05','P034',9,0),('2026-09-05','P035',0,0),('2026-09-05','P036',8,0),('2026-09-05','P037',12,0),('2026-09-05','P038',0,0),('2026-09-05','P039',0,0),('2026-09-05','P040',9,0),
    ('2026-09-06','P001',96,0),('2026-09-06','P002',20,0),('2026-09-06','P003',7,0),('2026-09-06','P004',4,0),('2026-09-06','P005',6,0),('2026-09-06','P006',1,0),('2026-09-06','P007',5,0),('2026-09-06','P008',0,0),('2026-09-06','P009',1,0),('2026-09-06','P010',3,0),
    ('2026-09-06','P011',0,0),('2026-09-06','P012',0,0),('2026-09-06','P013',8,0),('2026-09-06','P014',0,0),('2026-09-06','P015',3,0),('2026-09-06','P016',0,0),('2026-09-06','P017',1,0),('2026-09-06','P018',0,0),('2026-09-06','P019',3,0),('2026-09-06','P020',0,0),
    ('2026-09-06','P021',0,0),('2026-09-06','P022',13,0),('2026-09-06','P023',3,0),('2026-09-06','P024',3,0),('2026-09-06','P025',11,0),('2026-09-06','P026',1,0),('2026-09-06','P027',1,0),('2026-09-06','P028',0,0),('2026-09-06','P029',5,0),('2026-09-06','P030',3,0),
    ('2026-09-06','P031',3,0),('2026-09-06','P032',5,0),('2026-09-06','P033',6,0),('2026-09-06','P034',9,0),('2026-09-06','P035',0,0),('2026-09-06','P036',9,0),('2026-09-06','P037',13,0),('2026-09-06','P038',1,0),('2026-09-06','P039',1,0),('2026-09-06','P040',5,0)
), prepared as (
  select dj.id as daily_journal_id,
         date_trunc('month', s.business_date)::date as period_month,
         pm.id as product_id,
         substring(s.product_code from 2)::integer as rank,
         s.issued_count + s.settlement_count as quantity,
         s.issued_count,
         s.settlement_count,
         pm.standard_price as unit_price,
         (s.issued_count + s.settlement_count) * pm.standard_price as sales_amount,
         'daily_original_verified:' || d.file_name as source_scope
  from source_rows s
  join rev2.daily_journal dj on dj.business_date = s.business_date
  join rev2.product_master pm on pm.product_code = s.product_code
  join rev2.documents d on d.business_date = s.business_date
    and d.document_type = 'journal_product_daily'
    and d.retention_status = 'preserved'
)
insert into rev2.journal_products (
  daily_journal_id, period_month, product_id, rank, quantity,
  issued_count, settlement_count, unit_price, sales_amount, source_scope
)
select daily_journal_id, period_month, product_id, rank, quantity,
       issued_count, settlement_count, unit_price, sales_amount, source_scope
from prepared
on conflict (daily_journal_id, product_id, unit_price)
  where daily_journal_id is not null
do update set
  rank = excluded.rank,
  quantity = excluded.quantity,
  issued_count = excluded.issued_count,
  settlement_count = excluded.settlement_count,
  sales_amount = excluded.sales_amount,
  source_scope = excluded.source_scope;

do $$
declare
  bad_dates text;
begin
  select string_agg(business_date::text, ', ' order by business_date)
  into bad_dates
  from (
    select dj.business_date
    from rev2.daily_journal dj
    left join rev2.journal_products jp on jp.daily_journal_id = dj.id
    where dj.business_date between date '2026-09-02' and date '2026-09-06'
    group by dj.id, dj.business_date, dj.sales_total
    having count(jp.id) <> 40 or sum(jp.sales_amount) <> dj.sales_total
  ) failures;

  if bad_dates is not null then
    raise exception '9月商品原票の40品目検算に失敗: %', bad_dates;
  end if;
end;
$$;

commit;
