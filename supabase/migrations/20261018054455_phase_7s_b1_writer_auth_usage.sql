-- Additive correction; DO NOT apply until owner review authorizes it.
-- Hosted auth is managed by Supabase. Ordinary postgres can have USAGE without
-- its grant option: repeating GRANT as that role can warn and grant nothing.
-- An authorized auth-schema owner/grantor must supply this one privilege.
begin;
do $$
begin
  if not has_schema_privilege('h4_sync_writer', 'auth', 'USAGE') then
    if not has_schema_privilege(current_user, 'auth', 'USAGE WITH GRANT OPTION') then
      raise exception 'Cannot grant auth USAGE to h4_sync_writer as %', current_user
        using errcode = '42501',
        hint = 'Stop. Ask the authorized auth schema owner/grantor to supply only USAGE on auth to h4_sync_writer; do not elevate the writer or grant it another role.';
    end if;
    grant usage on schema auth to h4_sync_writer;
  end if;
  -- Assert effective privileges, not just the presence of a GRANT statement.
  if not has_schema_privilege('h4_sync_writer', 'auth', 'USAGE') then
    raise exception 'h4_sync_writer still lacks auth schema USAGE' using errcode = '42501';
  end if;
  if not has_function_privilege('h4_sync_writer', 'auth.uid()', 'EXECUTE') or
     not has_function_privilege('h4_sync_writer', 'auth.jwt()', 'EXECUTE') or
     not has_column_privilege('h4_sync_writer', 'auth.sessions', 'id', 'SELECT') or
     not has_column_privilege('h4_sync_writer', 'auth.sessions', 'user_id', 'SELECT') then
    raise exception 'Existing B1 Auth function/session-column permissions are incomplete'
      using errcode = '42501', hint = 'Stop and review the B1 grants; this correction grants schema USAGE only.';
  end if;
end;
$$;
commit;
