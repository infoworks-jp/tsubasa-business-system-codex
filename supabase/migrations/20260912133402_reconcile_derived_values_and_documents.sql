update rev2.daily_journal
set average_spend = round(sales_total::numeric / customer_count), updated_at = now()
where customer_count > 0
  and average_spend is distinct from round(sales_total::numeric / customer_count);

update rev2.documents
set document_type = 'historical_payroll_ledger'
where file_name = '20260911105907212.pdf'
  and page = '33'
  and document_type = 'historical_sales_ledger';
