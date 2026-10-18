-- Run with psql -X -v ON_ERROR_STOP=1 -f supabase/tests/foundation.sql
-- ONLY on an explicitly approved disposable local/test database after migration.
-- SQL role/claims tests are not proof of JWT verification by the HTTP gateway.
begin;
set local statement_timeout = '30s';
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end;
$$;
insert into auth.users(id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into auth.sessions(id, user_id) values
('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- Catalog checks as operator, before exercising actual restricted roles.
select pg_temp.assert_true(not rolcanlogin and not rolinherit and not rolbypassrls and not rolsuper, 'writer attributes') from pg_roles where rolname = 'h4_sync_writer';
select pg_temp.assert_true(not exists (
  select 1 from pg_auth_members where roleid = 'h4_sync_writer'::regrole
  and member in ('anon'::regrole, 'authenticated'::regrole, 'authenticator'::regrole)
), 'browser roles may not assume writer');
select pg_temp.assert_true(not has_schema_privilege('h4_sync_writer', 'private', 'CREATE'), 'writer cannot replace functions');
select pg_temp.assert_true(not has_table_privilege('h4_sync_writer', 'public.student_progress', 'DELETE'), 'writer cannot delete');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.sync_progress(bigint,uuid,text,smallint)', 'EXECUTE'), 'anon RPC denied');
select pg_temp.assert_true(not has_function_privilege('anon', 'private.write_progress(bigint,uuid,text,smallint)', 'EXECUTE'), 'anon body denied');
select pg_temp.assert_true(c.relrowsecurity and c.relforcerowsecurity and c.relowner <> 'h4_sync_writer'::regrole, 'RLS and non-owner writer')
from pg_class c where c.oid in ('public.student_progress'::regclass, 'public.progress_submissions'::regclass);
select pg_temp.assert_true(p.proowner = 'h4_sync_writer'::regrole and p.prosecdef and 'search_path=""' = any(p.proconfig), 'restricted function owner/search path')
from pg_proc p where p.oid in ('private.has_current_session()'::regprocedure, 'private.write_progress(bigint,uuid,text,smallint)'::regprocedure);

select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role', 'authenticated', 'session_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'exp', extract(epoch from now())::bigint + 3600)::text, true);
set local role authenticated;
select pg_temp.assert_true((public.sync_progress(0, '00000000-0000-4000-8000-000000000001', '{"version":8,"goals":[],"synthetic":"A"}', 1::smallint)->>'revision')::bigint = 1, 'first A write');
select pg_temp.assert_true((public.sync_progress(1, '00000000-0000-4000-8000-000000000002', '{"version":8,"goals":[],"synthetic":"A2"}', 1::smallint)->>'revision')::bigint = 2, 'CAS A write');
select pg_temp.assert_true(public.sync_progress(0, '00000000-0000-4000-8000-000000000003', '{"version":8,"goals":[],"synthetic":"A conflict"}', 1::smallint)->>'outcome' = 'conflict', 'stale candidate preserved');
select pg_temp.assert_true((public.sync_progress(1, '00000000-0000-4000-8000-000000000002', '{"version":8,"goals":[],"synthetic":"A2"}', 1::smallint)->>'duplicate')::boolean, 'same retry receipt');
select pg_temp.assert_true((select revision = 2 from public.student_progress), 'retry/conflict did not advance head');
select pg_temp.assert_true((select count(*) = 3 from public.progress_submissions), 'retry did not duplicate receipt');
select pg_temp.assert_true((select state_text is not null from public.progress_submissions where outcome = 'conflict'), 'conflict raw retained');
do $$ begin
  begin perform public.sync_progress(1, '00000000-0000-4000-8000-000000000002', '{"version":8,"goals":[]}', 1::smallint); raise exception 'FAILED: changed request accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.sync_progress(3, gen_random_uuid(), '{"version":8,"goals":[]}', 1::smallint); raise exception 'FAILED: future base'; exception when invalid_parameter_value then null; end;
  begin perform public.sync_progress(2, gen_random_uuid(), '{"version":"8","goals":[]}', 1::smallint); raise exception 'FAILED: string version'; exception when invalid_parameter_value then null; end;
  begin update public.student_progress set revision = 100; raise exception 'FAILED: direct update'; exception when insufficient_privilege then null; end;
  begin delete from public.progress_submissions; raise exception 'FAILED: direct delete'; exception when insufficient_privilege then null; end;
  begin insert into public.student_progress select * from public.student_progress; raise exception 'FAILED: direct insert'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'role', 'authenticated', 'session_id', 'bbbbbbbb-0000-4000-8000-000000000001', 'exp', extract(epoch from now())::bigint + 3600)::text, true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.student_progress), 'B cannot read A');
select pg_temp.assert_true((select count(*) = 0 from public.progress_submissions), 'B cannot read A receipts');
select pg_temp.assert_true(public.sync_progress(0, '00000000-0000-4000-8000-000000000001', '{"version":8,"goals":[],"synthetic":"B"}', 1::smallint)->>'outcome' = 'accepted', 'same request UUID belongs independently to B');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role', 'authenticated', 'session_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'exp', extract(epoch from now())::bigint + 3600, 'user_metadata', json_build_object('sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'admin', true))::text, true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.student_progress where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'A metadata does not grant B access');
reset role;
-- Restricted writer's RLS must still apply inside SECURITY DEFINER code.
set local role h4_sync_writer;
select pg_temp.assert_true((select count(*) = 0 from public.student_progress where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'writer cannot read B under A claims');
do $$ begin
  begin update public.student_progress set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; raise exception 'FAILED: writer reassignment'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Server session revocation denies still-unexpired claims.
delete from auth.sessions where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.student_progress), 'revoked A cannot read');
do $$ begin
  begin perform public.sync_progress(2, gen_random_uuid(), '{"version":8,"goals":[]}', 1::smallint); raise exception 'FAILED: revoked write'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin perform count(*) from public.student_progress; raise exception 'FAILED: anon read'; exception when insufficient_privilege then null; end;
  begin perform public.sync_progress(0, gen_random_uuid(), '{"version":8,"goals":[]}', 1::smallint); raise exception 'FAILED: anon RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from auth.users where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select pg_temp.assert_true((select count(*) = 0 from public.student_progress where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'delete cascade head');
select pg_temp.assert_true((select count(*) = 0 from public.progress_submissions where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'delete cascade submissions');
rollback;
