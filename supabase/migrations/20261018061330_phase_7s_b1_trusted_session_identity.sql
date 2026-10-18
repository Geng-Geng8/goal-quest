-- REVISED B1 PROPOSAL, NOT APPLIED. Replaces the unapplied grant-dependent fix.
-- Original deployed baseline stays unchanged. Run as the ordinary postgres
-- project operator only after review. No managed-schema grants are required.
begin;
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
    raise exception 'B1 session helper requires the audited postgres operator permissions' using errcode = '42501';
  end if;
  if exists (select 1 from pg_roles where rolname = 'h4_sync_writer' and
      (rolcanlogin or rolinherit or rolbypassrls or rolsuper)) or
     (select proowner from pg_proc where oid = 'private.write_progress(bigint,uuid,text,smallint)'::regprocedure) <> 'h4_sync_writer'::regrole then
    raise exception 'B1 writer boundary differs from the reviewed baseline' using errcode = '42501';
  end if;
end;
$$;

-- The ONLY postgres-owned definer here. No arguments, dynamic SQL, progress
-- table access or mutation. Auth/PostgREST must verify JWTs before setting the
-- transaction-local claims; ordinary clients cannot set that context via RPC.
create function private.current_student_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare claims jsonb; student_id uuid; session_id uuid;
begin
  claims := (select auth.jwt());
  student_id := (select auth.uid());
  if student_id is null or claims ->> 'role' is distinct from 'authenticated' or
     coalesce((claims ->> 'is_anonymous')::boolean, false) then return null; end if;
  if coalesce(claims ->> 'exp', '') !~ '^[0-9]{1,12}$' then return null; end if;
  if (claims ->> 'exp')::bigint <= extract(epoch from statement_timestamp()) then return null; end if;
  session_id := (claims ->> 'session_id')::uuid;
  if not exists (select 1 from auth.sessions s where s.id = session_id and s.user_id = student_id) then return null; end if;
  return student_id;
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end;
$$;
alter function private.current_student_id() owner to postgres;
revoke all on function private.current_student_id() from public, anon, authenticated, service_role, h4_sync_writer;
grant execute on function private.current_student_id() to authenticated, h4_sync_writer;

-- Preserve the existing boolean interface for callers/tests. No elevated
-- privileges or direct Auth references remain in this compatibility wrapper.
create or replace function private.has_current_session() returns boolean
language sql stable security invoker set search_path = '' as $$
  select (select private.current_student_id()) is not null;
$$;
revoke all on function private.has_current_session() from public, anon, authenticated, service_role;
grant execute on function private.has_current_session() to authenticated, h4_sync_writer;

-- Both read and write policies derive the owner from the SAME active-session
-- result. The restricted writer no longer has to resolve anything in auth.
alter policy progress_read_own on public.student_progress
  using ((select private.current_student_id()) = user_id);
alter policy submissions_read_own on public.progress_submissions
  using ((select private.current_student_id()) = user_id);
alter policy progress_write_own on public.student_progress
  using ((select private.current_student_id()) = user_id)
  with check ((select private.current_student_id()) = user_id);
alter policy submissions_write_own on public.progress_submissions
  using ((select private.current_student_id()) = user_id)
  with check ((select private.current_student_id()) = user_id);

create or replace function private.write_progress(p_base_revision bigint, p_request_id uuid, p_state_text text, p_protocol_version smallint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := (select private.current_student_id()); head public.student_progress%rowtype;
  receipt public.progress_submissions%rowtype; payload_hash bytea; result_revision bigint;
  result_outcome text; retained_bytes bigint; receipt_count bigint;
begin
  if owner_id is null then raise exception 'Active session required' using errcode = '42501'; end if;
  if p_protocol_version is distinct from 1 or p_base_revision is null or
     p_base_revision not between 0 and 9007199254740991 or p_request_id is null or
     p_request_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Invalid protocol, revision or request ID' using errcode = '22023';
  end if;
  if p_state_text is null or octet_length(p_state_text) not between 1 and 2097152 then
    raise exception 'Snapshot size limit' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  -- Built-in SHA-256 (Postgres 15+), no extension or caller-provided hash.
  payload_hash := sha256(convert_to(p_state_text, 'UTF8'));
  select * into receipt from public.progress_submissions where user_id = owner_id and request_id = p_request_id;
  if found then
    if receipt.payload_sha256 <> payload_hash or receipt.base_revision <> p_base_revision or receipt.protocol_version <> p_protocol_version then
      raise exception 'Request ID already used with different input' using errcode = '22023';
    end if;
    return jsonb_build_object('outcome', receipt.outcome, 'revision', receipt.result_revision, 'request_id', p_request_id, 'duplicate', true);
  end if;
  -- These limits count committed requests. Invalid/rolled-back requests require
  -- gateway throttling + a role statement timeout; see the B1 limitations report.
  select count(*) into receipt_count from public.progress_submissions where user_id = owner_id;
  if receipt_count >= 2000 or
     (select count(*) from public.progress_submissions where user_id = owner_id and created_at > now() - interval '1 minute') >= 30 or
     (select count(*) from public.progress_submissions where user_id = owner_id and created_at > now() - interval '1 day') >= 500 then
    raise exception 'Request quota reached; keep local candidate' using errcode = '54000';
  end if;
  if not private.valid_progress_envelope(p_state_text) then raise exception 'Invalid snapshot envelope' using errcode = '22023'; end if;
  select * into head from public.student_progress where user_id = owner_id for update;
  if not found then
    if p_base_revision <> 0 then raise exception 'Nonexistent base revision' using errcode = '22023'; end if;
    result_revision := 1; result_outcome := 'accepted';
  elsif p_base_revision > head.revision then
    raise exception 'Future base revision' using errcode = '22023';
  elsif p_base_revision = head.revision then
    if head.revision = 9007199254740991 then raise exception 'Revision exhausted' using errcode = '54000'; end if;
    result_revision := head.revision + 1; result_outcome := 'accepted';
  else
    result_revision := head.revision; result_outcome := 'conflict';
  end if;
  if result_outcome = 'conflict' and
     (select count(*) from public.progress_submissions where user_id = owner_id and outcome = 'conflict' and resolved_at is null) >= 10 then
    raise exception 'Conflict quota reached; keep local candidate' using errcode = '54000';
  end if;
  -- Compaction + insertion + CAS all roll back together on any quota/error.
  insert into public.progress_submissions (user_id, request_id, base_revision, result_revision, outcome, protocol_version, data_version, payload_sha256, state_text)
  values (owner_id, p_request_id, p_base_revision, result_revision, result_outcome, 1, 8, payload_hash, p_state_text);
  update public.progress_submissions set state_text = null
  where user_id = owner_id and outcome = 'accepted' and state_text is not null and request_id not in (
    select request_id from public.progress_submissions where user_id = owner_id and outcome = 'accepted'
    order by result_revision desc limit 3
  );
  select coalesce(sum(octet_length(state_text)), 0) into retained_bytes from public.progress_submissions where user_id = owner_id;
  retained_bytes := retained_bytes + case when result_outcome = 'accepted' then octet_length(p_state_text) else coalesce(octet_length(head.state_text), 0) end;
  if retained_bytes > 16777216 then raise exception 'Storage quota reached; keep local candidate' using errcode = '54000'; end if;
  if head.user_id is null then
    insert into public.student_progress values (owner_id, result_revision, 1, 8, p_state_text, p_request_id, now());
  elsif result_outcome = 'accepted' then
    update public.student_progress set revision = result_revision, state_text = p_state_text, last_request_id = p_request_id, updated_at = now()
    where user_id = owner_id and revision = p_base_revision;
    if not found then raise exception 'Revision changed' using errcode = '40001'; end if;
  end if;
  return jsonb_build_object('outcome', result_outcome, 'revision', result_revision, 'request_id', p_request_id, 'duplicate', false);
end;
$$;

-- CREATE OR REPLACE preserves the existing restricted owner and grants.
-- Fail if that boundary or the existing RLS protection changed unexpectedly.
do $$
begin
  if (select proowner from pg_proc where oid = 'private.write_progress(bigint,uuid,text,smallint)'::regprocedure) <> 'h4_sync_writer'::regrole or
     (select proowner from pg_proc where oid = 'private.has_current_session()'::regprocedure) <> 'h4_sync_writer'::regrole or
     exists (select 1 from pg_class where oid in ('public.student_progress'::regclass, 'public.progress_submissions'::regclass)
       and (not relrowsecurity or not relforcerowsecurity or relowner = 'h4_sync_writer'::regrole)) then
    raise exception 'B1 restricted writer/RLS postcondition failed' using errcode = '42501';
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
