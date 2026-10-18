-- B1 PROPOSAL: synthetic tests only; NOT approved/applied for student use.
-- Reduced server semantics and numeric limits await explicit owner approval.
begin;
set local statement_timeout = '15s';

create role h4_sync_writer nologin noinherit nobypassrls;
-- Trusted migration operator only: permits ownership assignment/maintenance on
-- PostgreSQL versions where CREATEROLE alone does not imply SET ROLE rights.
-- Never grant this role to anon, authenticated or authenticator.
grant h4_sync_writer to current_user;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, h4_sync_writer;
grant usage on schema public, auth to h4_sync_writer;
revoke create on schema public from public, anon, authenticated, h4_sync_writer;
grant execute on function auth.uid(), auth.jwt() to h4_sync_writer;
grant select (id, user_id) on auth.sessions to h4_sync_writer;

create table public.student_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision between 1 and 9007199254740991),
  protocol_version smallint not null check (protocol_version = 1),
  data_version smallint not null check (data_version = 8),
  state_text text not null check (octet_length(state_text) between 1 and 2097152),
  last_request_id uuid not null,
  updated_at timestamptz not null default now()
);
create table public.progress_submissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  base_revision bigint not null check (base_revision between 0 and 9007199254740991),
  result_revision bigint not null check (result_revision between 1 and 9007199254740991),
  outcome text not null check (outcome in ('accepted', 'conflict')),
  protocol_version smallint not null check (protocol_version = 1),
  data_version smallint not null check (data_version = 8),
  payload_sha256 bytea not null check (octet_length(payload_sha256) = 32),
  state_text text check (state_text is null or octet_length(state_text) between 1 and 2097152),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (user_id, request_id),
  check (outcome <> 'conflict' or resolved_at is not null or state_text is not null)
);
create index progress_submissions_owner_time on public.progress_submissions (user_id, created_at desc);

-- json preserves raw text/unknown numeric literals; never normalize to jsonb.
create function private.valid_progress_envelope(p_text text) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare payload json;
begin
  if p_text is null or octet_length(p_text) not between 1 and 2097152 then return false; end if;
  payload := p_text::json;
  if json_typeof(payload) is distinct from 'object' then return false; end if;
  if json_typeof(payload -> 'version') is distinct from 'number' then return false; end if;
  if (payload ->> 'version')::numeric <> 8 then return false; end if;
  if json_typeof(payload -> 'goals') is distinct from 'array' then return false; end if;
  return json_array_length(payload -> 'goals') <= 1000;
exception when invalid_text_representation or numeric_value_out_of_range or untranslatable_character then
  return false;
end;
$$;
revoke all on function private.valid_progress_envelope(text) from public, anon, authenticated;
grant execute on function private.valid_progress_envelope(text) to h4_sync_writer;
alter table public.student_progress add constraint progress_envelope check (private.valid_progress_envelope(state_text));
alter table public.progress_submissions add constraint submission_envelope check (state_text is null or private.valid_progress_envelope(state_text));

create function private.has_current_session() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare claims jsonb := (select auth.jwt()); owner_id uuid := (select auth.uid()); session_uuid uuid;
begin
  if owner_id is null or coalesce((claims ->> 'is_anonymous')::boolean, false) then return false; end if;
  if coalesce(claims ->> 'exp', '') !~ '^[0-9]{1,12}$' then return false; end if;
  if (claims ->> 'exp')::bigint <= extract(epoch from statement_timestamp()) then return false; end if;
  session_uuid := (claims ->> 'session_id')::uuid;
  return exists (select 1 from auth.sessions s where s.id = session_uuid and s.user_id = owner_id);
exception when invalid_text_representation then return false;
end;
$$;

alter table public.student_progress enable row level security;
alter table public.student_progress force row level security;
alter table public.progress_submissions enable row level security;
alter table public.progress_submissions force row level security;
revoke all on public.student_progress, public.progress_submissions from public, anon, authenticated;
grant select on public.student_progress, public.progress_submissions to authenticated;
grant select, insert, update on public.student_progress, public.progress_submissions to h4_sync_writer;

create policy progress_read_own on public.student_progress for select to authenticated
using ((select auth.uid()) = user_id and (select private.has_current_session()));
create policy submissions_read_own on public.progress_submissions for select to authenticated
using ((select auth.uid()) = user_id and (select private.has_current_session()));
create policy progress_write_own on public.student_progress for all to h4_sync_writer
using ((select auth.uid()) = user_id and (select private.has_current_session()))
with check ((select auth.uid()) = user_id and (select private.has_current_session()));
create policy submissions_write_own on public.progress_submissions for all to h4_sync_writer
using ((select auth.uid()) = user_id and (select private.has_current_session()))
with check ((select auth.uid()) = user_id and (select private.has_current_session()));

create function private.write_progress(p_base_revision bigint, p_request_id uuid, p_state_text text, p_protocol_version smallint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := (select auth.uid()); head public.student_progress%rowtype;
  receipt public.progress_submissions%rowtype; payload_hash bytea; result_revision bigint;
  result_outcome text; retained_bytes bigint; receipt_count bigint;
begin
  if not private.has_current_session() then raise exception 'Active session required' using errcode = '42501'; end if;
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

create function public.sync_progress(p_base_revision bigint, p_request_id uuid, p_state_text text, p_protocol_version smallint)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.write_progress(p_base_revision, p_request_id, p_state_text, p_protocol_version);
$$;
-- Ownership assignment requires temporary CREATE; writer owns neither table.
grant create on schema private to h4_sync_writer;
alter function private.has_current_session() owner to h4_sync_writer;
alter function private.write_progress(bigint, uuid, text, smallint) owner to h4_sync_writer;
revoke create on schema private from h4_sync_writer;
revoke all on function private.has_current_session() from public, anon, authenticated;
grant execute on function private.has_current_session() to authenticated, h4_sync_writer;
revoke all on function private.write_progress(bigint, uuid, text, smallint) from public, anon, authenticated;
grant execute on function private.write_progress(bigint, uuid, text, smallint) to authenticated;
revoke all on function public.sync_progress(bigint, uuid, text, smallint) from public, anon, authenticated;
grant execute on function public.sync_progress(bigint, uuid, text, smallint) to authenticated;

-- Dedicated TEST project only. Recycle REST pool connections after applying and
-- verify the effective timeout through REST; function-local SET is insufficient.
alter role authenticated set statement_timeout = '5s';
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
commit;
