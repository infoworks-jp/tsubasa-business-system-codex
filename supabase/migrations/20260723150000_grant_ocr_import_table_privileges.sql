begin;

-- Required for anon-key server client to read/write OCR import queue tables.
grant select, insert on table public.ticket_ocr_imports to anon, authenticated;
grant select, insert on table public.ticket_ocr_import_rows to anon, authenticated;

commit;
