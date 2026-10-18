// Source-contract checks, not execution of SQL or proof of hosted security.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const baseline = read('supabase/migrations/20261018051112_phase_7s_b1_foundation.sql');
const revised = read('supabase/migrations/20261018061330_phase_7s_b1_trusted_session_identity.sql');
const body = (source, name) => {
  const start = source.indexOf(`function private.${name}(`);
  assert.ok(start >= 0);
  const end = source.indexOf('$$;', start);
  assert.ok(end > start);
  return source.slice(start, end + 3);
};

test('source contract: CAS/conflict/receipt/quota writer body changes only its verified identity source and guard', () => {
  const expected = body(baseline, 'write_progress')
    .replace('owner_id uuid := (select auth.uid());', 'owner_id uuid := (select private.current_student_id());')
    .replace('if not private.has_current_session() then', 'if owner_id is null then');
  assert.equal(body(revised, 'write_progress'), expected);
  assert.doesNotMatch(body(revised, 'write_progress'), /auth\./);
  assert.doesNotMatch(revised, /owner to postgres;[\s\S]*alter function private\.write_progress/);
  assert.equal((revised.match(/alter policy /g) || []).length, 4);
  const policies = revised.slice(revised.indexOf('alter policy '), revised.indexOf('create or replace function private.write_progress'));
  assert.equal((policies.match(/select private\.current_student_id\(\)/g) || []).length, 6);
  assert.doesNotMatch(policies, /auth\.|has_current_session/);
});

test('source contract: privileged identity helper has no inputs, writes, progress access or dynamic SQL', () => {
  const helper = body(revised, 'current_student_id');
  assert.match(helper, /current_student_id\(\) returns uuid/);
  assert.match(helper, /stable security definer set search_path = ''/);
  assert.match(helper, /s\.id = session_id and s\.user_id = student_id/);
  assert.match(helper, /is_anonymous/); assert.match(helper, /statement_timestamp\(\)/);
  assert.doesNotMatch(helper, /\b(?:insert|update|delete|execute|set_config|student_progress|progress_submissions)\b/i);
  assert.match(revised, /revoke all on function private\.current_student_id\(\) from public, anon, authenticated, service_role, h4_sync_writer;/);
  assert.match(revised, /grant execute on function private\.current_student_id\(\) to authenticated, h4_sync_writer;/);
  assert.doesNotMatch(revised, /grant (?:usage on schema auth|[^;]+ to h4_sync_writer with grant option)/i);
});
