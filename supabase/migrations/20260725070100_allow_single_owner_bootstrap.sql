begin;

create or replace function public.require_owner_metadata_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'access_role', '') = 'owner' then
    return new;
  end if;

  if coalesce(new.raw_user_meta_data ->> 'owner_bootstrap', '') = 'true'
    and not exists (select 1 from auth.users) then
    new.raw_app_meta_data :=
      coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('access_role', 'owner');
    new.raw_user_meta_data :=
      coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'owner_bootstrap';
    return new;
  end if;

  raise exception 'new auth users must be provisioned as the approved owner';
end;
$$;

commit;
