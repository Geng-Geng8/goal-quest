-- OPERATOR TEMPLATE ONLY. Separate approval required; no browser grant or cron.
-- Run on an approved test target first, with the same owner advisory lock as RPC.
-- Set the psql variable owner_id to the verified UUID; never map by typed email.
begin;
select pg_advisory_xact_lock(hashtextextended(:'owner_id'::uuid::text, 0));
update public.progress_submissions set state_text = null
where user_id = :'owner_id'::uuid and outcome = 'conflict' and resolved_at < now() - interval '7 days';
delete from public.progress_submissions
where user_id = :'owner_id'::uuid and created_at < now() - interval '30 days'
and (outcome = 'accepted' or (outcome = 'conflict' and resolved_at < now() - interval '7 days'))
and request_id not in (
  select request_id from public.progress_submissions where user_id = :'owner_id'::uuid and outcome = 'accepted'
  order by result_revision desc limit 3
)
and request_id not in (select last_request_id from public.student_progress where user_id = :'owner_id'::uuid);
commit;
-- Never delete/compact unresolved conflicts. No B1 resolution API is provided.
