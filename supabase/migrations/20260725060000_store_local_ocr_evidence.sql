begin;

alter table public.ticket_ocr_imports
  add column if not exists ocr_raw_text text,
  add column if not exists ocr_confidence numeric
    check (ocr_confidence is null or (ocr_confidence >= 0 and ocr_confidence <= 100));

comment on column public.ticket_ocr_imports.ocr_raw_text is
  'ローカルOCRが返した未加工の原文。人による修正後も上書きしない。';
comment on column public.ticket_ocr_imports.ocr_confidence is
  'ローカルOCRエンジンが返した実測信頼度。推測・丸めをしない。';

create or replace function public.preserve_local_ocr_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.ocr_raw_text is not null
      and new.ocr_raw_text is distinct from old.ocr_raw_text then
      raise exception 'ocr_raw_text is immutable after saving';
    end if;
    if old.ocr_confidence is not null
      and new.ocr_confidence is distinct from old.ocr_confidence then
      raise exception 'ocr_confidence is immutable after saving';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ticket_ocr_imports_preserve_local_evidence
  on public.ticket_ocr_imports;
create trigger ticket_ocr_imports_preserve_local_evidence
before update of ocr_raw_text, ocr_confidence on public.ticket_ocr_imports
for each row execute function public.preserve_local_ocr_evidence();

commit;
