begin;

alter table public.ticket_ocr_imports
  drop constraint if exists ticket_ocr_imports_queue_status_check;

alter table public.ticket_ocr_imports
  add constraint ticket_ocr_imports_queue_status_check
  check (queue_status in ('new', 'confirmed', 'needs-review', 'error'));

commit;
