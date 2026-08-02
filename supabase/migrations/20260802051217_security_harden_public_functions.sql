alter function public.set_updated_at() set search_path = pg_catalog;

revoke execute on function public.rebuild_ticket_product_sales_totals()
from public, anon, authenticated;

revoke execute on function public.record_product_match_history()
from public, anon, authenticated;

grant execute on function public.rebuild_ticket_product_sales_totals()
to service_role;

grant execute on function public.record_product_match_history()
to service_role;
