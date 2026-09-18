create or replace function rev2.get_shift_workspace(
  p_workspace_key text,
  p_access_code text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, rev2, extensions
as $$
declare
  v_row rev2.shift_workspaces%rowtype;
begin
  if p_workspace_key !~ '^[a-z0-9_-]{3,40}$'
     or length(p_access_code) < 4
     or length(p_access_code) > 64 then
    raise exception '共有番号または共有先が正しくありません' using errcode = '22023';
  end if;

  select * into v_row
  from rev2.shift_workspaces
  where workspace_key = p_workspace_key;

  if not found then
    return jsonb_build_object('exists', false, 'revision', 0, 'payload', null);
  end if;

  if v_row.access_hash <> extensions.crypt(p_access_code, v_row.access_hash) then
    raise exception '共有番号が違います' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'exists', true,
    'revision', v_row.revision,
    'updated_at', v_row.updated_at,
    'payload', v_row.payload
  );
end;
$$;

create or replace function rev2.save_shift_workspace(
  p_workspace_key text,
  p_access_code text,
  p_payload jsonb,
  p_expected_revision bigint default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, rev2, extensions
as $$
declare
  v_row rev2.shift_workspaces%rowtype;
begin
  if p_workspace_key !~ '^[a-z0-9_-]{3,40}$'
     or length(p_access_code) < 4
     or length(p_access_code) > 64 then
    raise exception '共有番号は4文字以上で入力してください' using errcode = '22023';
  end if;
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 500000 then
    raise exception '保存データが正しくないか、大きすぎます' using errcode = '22023';
  end if;

  select * into v_row
  from rev2.shift_workspaces
  where workspace_key = p_workspace_key
  for update;

  if not found then
    insert into rev2.shift_workspaces(workspace_key, access_hash, payload)
    values (p_workspace_key, extensions.crypt(p_access_code, extensions.gen_salt('bf', 10)), p_payload)
    returning * into v_row;
  else
    if v_row.access_hash <> extensions.crypt(p_access_code, v_row.access_hash) then
      raise exception '共有番号が違います' using errcode = '28000';
    end if;
    if p_expected_revision is not null and p_expected_revision <> v_row.revision then
      raise exception '他の端末で更新されています。先に共有データを読込してください' using errcode = '40001';
    end if;
    update rev2.shift_workspaces
    set payload = p_payload,
        revision = revision + 1,
        updated_at = now()
    where workspace_key = p_workspace_key
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'exists', true,
    'revision', v_row.revision,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function rev2.get_shift_workspace(text, text) from public;
revoke all on function rev2.save_shift_workspace(text, text, jsonb, bigint) from public;
grant execute on function rev2.get_shift_workspace(text, text) to anon, authenticated;
grant execute on function rev2.save_shift_workspace(text, text, jsonb, bigint) to anon, authenticated;
