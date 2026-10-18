-- Read-only post-migration preflight for the split identity/writer boundary.
-- Requires the reviewed trusted_session_identity migration; never applies it.
begin read only;
do $$
begin
  if to_regprocedure('private.current_student_id()') is null then
    raise exception 'B1 preflight: reviewed trusted session helper is not installed' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_proc where oid = 'private.current_student_id()'::regprocedure
      and proowner = 'postgres'::regrole and prosecdef and pronargs = 0 and prorettype = 'uuid'::regtype
      and 'search_path=""' = any(proconfig)) then
    raise exception 'B1 preflight: identity helper owner/signature/search_path differs' using errcode = '42501';
  end if;
  if has_function_privilege('anon', 'private.current_student_id()', 'EXECUTE') or
     has_function_privilege('service_role', 'private.current_student_id()', 'EXECUTE') or
     not has_function_privilege('authenticated', 'private.current_student_id()', 'EXECUTE') or
     not has_function_privilege('h4_sync_writer', 'private.current_student_id()', 'EXECUTE') or
     exists (select 1 from pg_proc p cross join lateral aclexplode(p.proacl) acl
       where p.oid = 'private.current_student_id()'::regprocedure and acl.grantee = 0) then
    raise exception 'B1 preflight: identity helper EXECUTE grants differ' using errcode = '42501';
  end if;
  if exists (select 1 from pg_roles where rolname = 'h4_sync_writer' and
      (rolcanlogin or rolinherit or rolbypassrls or rolsuper)) or
     has_schema_privilege('h4_sync_writer', 'auth', 'USAGE') or
     has_schema_privilege('h4_sync_writer', 'private', 'CREATE') then
    raise exception 'B1 preflight: writer must stay restricted without direct Auth access' using errcode = '42501';
  end if;
end;
$$;
set local role h4_sync_writer;
do $$
begin
  perform private.current_student_id(); -- no claims/records returned
  if current_user <> 'h4_sync_writer' then raise exception 'Helper leaked its role context'; end if;
  begin
    perform auth.uid();
    raise exception 'Writer unexpectedly resolved auth directly';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
