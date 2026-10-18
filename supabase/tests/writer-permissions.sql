-- Read-only regression/preflight. Run before tests that seed synthetic accounts.
-- psql -X -v ON_ERROR_STOP=1 -f supabase/tests/writer-permissions.sql
-- Missing schema USAGE must fail explicitly, even when function EXECUTE is true.
begin read only;
do $$
begin
  if not has_schema_privilege('h4_sync_writer', 'auth', 'USAGE') then
    raise exception 'B1 preflight: h4_sync_writer lacks effective USAGE on schema auth'
      using errcode = '42501', hint = 'Review the additive writer_auth_usage migration and its authorized-grantor requirement before retrying security tests.';
  end if;
  if not has_function_privilege('h4_sync_writer', 'auth.uid()', 'EXECUTE') or
     not has_function_privilege('h4_sync_writer', 'auth.jwt()', 'EXECUTE') or
     not has_column_privilege('h4_sync_writer', 'auth.sessions', 'id', 'SELECT') or
     not has_column_privilege('h4_sync_writer', 'auth.sessions', 'user_id', 'SELECT') then
    raise exception 'B1 preflight: writer Auth function/session-column permissions are incomplete' using errcode = '42501';
  end if;
end;
$$;
-- Exercise actual schema/name resolution under the restricted role, without
-- exposing claims or reading session records. Operator needs existing SET ROLE.
set local role h4_sync_writer;
do $$
begin
  perform auth.uid();
  perform auth.jwt();
  perform s.id, s.user_id from auth.sessions s where false;
end;
$$;
rollback;
