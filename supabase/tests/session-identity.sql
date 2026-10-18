-- AFTER approved migration application, disposable synthetic test project only.
-- SQL claims simulation is NOT gateway JWT/signature verification. All rollback.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end;
$$;
insert into auth.users(id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into auth.sessions(id, user_id) values
('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role', 'authenticated', 'session_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'exp', extract(epoch from now())::bigint + 3600)::text, true);
set local role authenticated;
select pg_temp.assert_true(private.current_student_id() = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'A active identity');
do $$ begin
  begin perform private.current_student_id('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid); raise exception 'FAILED: caller-selected identity'; exception when undefined_function then null; end;
  begin perform id from auth.sessions; raise exception 'FAILED: browser session data read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role h4_sync_writer;
select pg_temp.assert_true(not has_schema_privilege(current_user, 'auth', 'USAGE'), 'no writer Auth usage');
select pg_temp.assert_true(private.current_student_id() = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'writer can still verify A');
select pg_temp.assert_true(current_user = 'h4_sync_writer', 'identity call does not elevate writer');
do $$ begin
  begin perform auth.uid(); raise exception 'FAILED: writer Auth lookup'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Reject absent/malformed subjects, missing/wrong session ownership, expired
-- claims, anonymous Auth, non-authenticated roles and user-editable metadata.
set local role authenticated;
do $$ declare claims jsonb; good jsonb := jsonb_build_object(
  'sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role', 'authenticated',
  'session_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'exp', extract(epoch from now())::bigint + 3600);
begin
  for claims in select value from jsonb_array_elements(jsonb_build_array(
    good - 'sub', good || '{"sub":"bad"}', good - 'session_id', good || '{"session_id":"bad"}',
    good || '{"session_id":"bbbbbbbb-0000-4000-8000-000000000001"}', good - 'exp',
    good || '{"exp":1}', good || '{"exp":"bad"}', good || '{"is_anonymous":true}',
    good || '{"role":"anon"}', good - 'role', '{}'::jsonb
  )) loop
    perform set_config('request.jwt.claims', claims::text, true);
    perform pg_temp.assert_true(private.current_student_id() is null, 'bad context fails closed');
  end loop;
  perform set_config('request.jwt.claims', (good || '{"user_metadata":{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","admin":true}}')::text, true);
  perform pg_temp.assert_true(private.current_student_id() = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'metadata cannot change A');
end $$;
reset role;
-- Real row revocation is checked independently of unexpired JWT claims.
delete from auth.sessions where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.assert_true(private.current_student_id() is null and not private.has_current_session(), 'revoked A denied');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'role', 'authenticated', 'session_id', 'bbbbbbbb-0000-4000-8000-000000000001', 'exp', extract(epoch from now())::bigint + 3600)::text, true);
set local role authenticated;
select pg_temp.assert_true(private.current_student_id() = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'B remains independently valid');
reset role;
set local role anon;
do $$ begin
  begin perform private.current_student_id(); raise exception 'FAILED: anon helper access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
