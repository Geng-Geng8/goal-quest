-- READ-ONLY. Works BEFORE the new migration; verifies available ordinary
-- operator permissions without creating functions, grants or synthetic data.
begin read only;
do $$
begin
  if current_user <> 'postgres' or
     not has_schema_privilege(current_user, 'private', 'CREATE') or
     not has_schema_privilege(current_user, 'auth', 'USAGE') or
     not has_function_privilege(current_user, 'auth.uid()', 'EXECUTE') or
     not has_function_privilege(current_user, 'auth.jwt()', 'EXECUTE') or
     not has_column_privilege(current_user, 'auth.sessions', 'id', 'SELECT') or
     not has_column_privilege(current_user, 'auth.sessions', 'user_id', 'SELECT') or
     not pg_has_role(current_user, 'h4_sync_writer', 'SET') then
    raise exception 'B1 ordinary operator lacks a required helper/migration permission' using errcode = '42501';
  end if;
  perform auth.uid();
  perform auth.jwt();
  perform s.id, s.user_id from auth.sessions s where false;
end;
$$;
select 'PASS: ordinary postgres helper prerequisites; no migration applied' as result;
rollback;
