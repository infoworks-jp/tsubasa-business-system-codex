begin;

create or replace function public.require_owner_metadata_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'access_role', '') <> 'owner' then
    raise exception 'new auth users must be provisioned as the approved owner';
  end if;
  return new;
end;
$$;

drop trigger if exists auth_users_require_owner_metadata on auth.users;
create trigger auth_users_require_owner_metadata
before insert on auth.users
for each row execute function public.require_owner_metadata_for_auth_user();

revoke all on function public.require_owner_metadata_for_auth_user() from public;

commit;
