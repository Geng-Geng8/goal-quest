-- Additional transactional resource/compaction tests; APPROVED TEST DB ONLY.
-- Uses isolated synthetic UUIDs and rolls everything back. No pgTAP dependency.
begin;
set local statement_timeout = '30s';
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end;
$$;
insert into auth.users(id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into auth.sessions(id, user_id) values ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select set_config('request.jwt.claims', json_build_object('sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'role', 'authenticated', 'session_id', 'cccccccc-0000-4000-8000-000000000001', 'exp', extract(epoch from now())::bigint + 3600)::text, true);
set local role authenticated;
do $$ declare i integer; begin
  for i in 0..4 loop perform public.sync_progress(i, gen_random_uuid(), '{"version":8,"goals":[]}', 1::smallint); end loop;
end $$;
select pg_temp.assert_true((select count(*) = 3 from public.progress_submissions where state_text is not null), 'only three accepted payloads');
select pg_temp.assert_true((select count(*) = 5 from public.progress_submissions), 'compaction keeps receipts');
select pg_temp.assert_true((select (public.sync_progress(base_revision, request_id, '{"version":8,"goals":[]}', 1::smallint)->>'duplicate')::boolean from public.progress_submissions where result_revision = 1), 'compacted receipt still deduplicates');
do $$ declare i integer; begin
  for i in 1..10 loop perform public.sync_progress(0, gen_random_uuid(), '{"version":8,"goals":[],"conflict":true}', 1::smallint); end loop;
  begin perform public.sync_progress(0, gen_random_uuid(), '{"version":8,"goals":[]}', 1::smallint); raise exception 'FAILED: conflict cap'; exception when program_limit_exceeded then null; end;
end $$;
select pg_temp.assert_true((select count(*) = 10 from public.progress_submissions where outcome = 'conflict' and state_text is not null), 'quota preserves all unresolved conflicts');
reset role;
delete from public.progress_submissions where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
delete from public.student_progress where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
do $$ declare i integer; raw text := '{"version":8,"goals":[],"padding":"' || repeat('x', 2097115) || '"}'; before_count bigint; begin
  if octet_length(raw) <> 2097152 then raise exception 'Bad test fixture'; end if;
  perform public.sync_progress(0, gen_random_uuid(), raw, 1::smallint);
  perform public.sync_progress(1, gen_random_uuid(), raw, 1::smallint);
  perform public.sync_progress(2, gen_random_uuid(), raw, 1::smallint);
  -- 3 accepted + head + 4 conflicts fit at/under 16MiB; a fifth does not.
  for i in 1..4 loop perform public.sync_progress(0, gen_random_uuid(), raw, 1::smallint); end loop;
  select count(*) into before_count from public.progress_submissions;
  begin perform public.sync_progress(0, gen_random_uuid(), raw, 1::smallint); raise exception 'FAILED: storage cap'; exception when program_limit_exceeded then null; end;
  perform pg_temp.assert_true((select count(*) = before_count from public.progress_submissions), 'quota rollback keeps all receipts');
  perform pg_temp.assert_true((select revision = 3 from public.student_progress), 'quota leaves head intact');
end $$;
reset role;
delete from public.progress_submissions where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
delete from public.student_progress where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
do $$ declare i integer; begin
  for i in 0..29 loop perform public.sync_progress(i, gen_random_uuid(), '{"version":8,"goals":[]}', 1::smallint); end loop;
  begin perform public.sync_progress(30, gen_random_uuid(), '{"version":8,"goals":[]}', 1::smallint); raise exception 'FAILED: minute cap'; exception when program_limit_exceeded then null; end;
end $$;
-- Original receipt still returned even at request quota.
select pg_temp.assert_true((select (public.sync_progress(base_revision, request_id, '{"version":8,"goals":[]}', 1::smallint)->>'duplicate')::boolean from public.progress_submissions where result_revision = 30), 'retry precedes quota');
reset role;
-- Backdate synthetic receipts to test the daily and metadata caps independently.
delete from public.progress_submissions where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
insert into public.progress_submissions(user_id, request_id, base_revision, result_revision, outcome, protocol_version, data_version, payload_sha256, created_at)
select 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', gen_random_uuid(), 0, 1, 'accepted', 1, 8, sha256(convert_to('{"version":8,"goals":[]}', 'UTF8')), now() - interval '1 hour' from generate_series(1,500);
set local role authenticated;
do $$ begin
  begin perform public.sync_progress(30, gen_random_uuid(), '{"version":8,"goals":[]}', 1::smallint); raise exception 'FAILED: daily cap'; exception when program_limit_exceeded then null; end;
end $$;
reset role;
update public.progress_submissions set created_at = now() - interval '2 days' where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
insert into public.progress_submissions(user_id, request_id, base_revision, result_revision, outcome, protocol_version, data_version, payload_sha256, created_at)
select 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', gen_random_uuid(), 0, 1, 'accepted', 1, 8, sha256(convert_to('{"version":8,"goals":[]}', 'UTF8')), now() - interval '2 days' from generate_series(1,1500);
set local role authenticated;
do $$ begin
  begin perform public.sync_progress(30, gen_random_uuid(), '{"version":8,"goals":[]}', 1::smallint); raise exception 'FAILED: receipt cap'; exception when program_limit_exceeded then null; end;
end $$;
reset role;
-- Expired, missing and malformed session claims fail closed independently.
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","session_id":"cccccccc-0000-4000-8000-000000000001","exp":1}', true);
set local role authenticated;
select pg_temp.assert_true(not private.has_current_session(), 'expired claim');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","session_id":"malformed","exp":9999999999}', true);
set local role authenticated;
select pg_temp.assert_true(not private.has_current_session(), 'malformed session claim');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","exp":9999999999}', true);
set local role authenticated;
select pg_temp.assert_true(not private.has_current_session(), 'missing session claim');
reset role;
rollback;
