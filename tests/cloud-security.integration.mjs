// Real HTTP integration: no mocks, service-role key, account provisioning or
// migrations. Intentionally skipped without explicit synthetic-test approval.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { emptyState } from '../js/data-safety.js';
import { cloudFixtures } from './support/cloud-fixtures.mjs';
import { inspectRemoteProgress } from '../js/cloud/validate-progress.js';

const env = process.env;
const approved = env.H4_TEST_APPROVED === 'synthetic-only';
const ready = approved && ['H4_TEST_URL', 'H4_TEST_PUBLISHABLE_KEY', 'H4_TEST_A_JWT', 'H4_TEST_B_JWT'].every(k => env[k]);
test('REAL Supabase HTTP isolation/CAS/fixtures (requires approved disposable project and adult A/B sessions)', { skip: !ready && 'No approved test project/session configuration; database security remains UNVERIFIED.' }, async t => {
  const url = new URL(env.H4_TEST_URL);
  assert.ok(/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url.origin) || /^http:\/\/(?:localhost|127\.0\.0\.1):54321$/.test(url.origin));
  assert.match(env.H4_TEST_PUBLISHABLE_KEY, /^sb_publishable_/);
  async function request(path, token, method = 'GET', body, extra = {}) {
    const response = await fetch(url.origin + path, { method, signal: AbortSignal.timeout(15000), headers: {
      apikey: env.H4_TEST_PUBLISHABLE_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json', ...extra
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = null; }
    return { status: response.status, ok: response.ok, data, contentRange: response.headers.get('content-range') };
  }
  const A = env.H4_TEST_A_JWT, B = env.H4_TEST_B_JWT;
  const aUser = await request('/auth/v1/user', A), bUser = await request('/auth/v1/user', B);
  assert.equal(aUser.status, 200); assert.equal(bUser.status, 200); assert.notEqual(aUser.data.id, bUser.data.id);
  const aID = aUser.data.id, bID = bUser.data.id;
  for (const token of [A, B]) {
    const head = await request('/rest/v1/student_progress?select=revision', token);
    assert.equal(head.status, 200); assert.deepEqual(head.data, [], 'Use NEW synthetic accounts; refusing existing progress.');
  }
  const text = marker => JSON.stringify({ ...emptyState(), synthetic: marker });
  const rpc = (token, base, id, raw, protocol = 1) => request('/rest/v1/rpc/sync_progress', token, 'POST', {
    p_base_revision: base, p_request_id: id, p_state_text: raw, p_protocol_version: protocol
  });
  const sameID = randomUUID(), aText = text('A initial'), bText = text('B private');
  assert.equal((await rpc(A, 0, sameID, aText)).data.outcome, 'accepted');
  assert.equal((await rpc(B, 0, sameID, bText)).data.outcome, 'accepted');
  await t.test('A and B cannot discover each other through tables, filters, count, range or embedded records', async () => {
    for (const [token, ownID, otherID] of [[A, aID, bID], [B, bID, aID]]) {
      for (const table of ['student_progress', 'progress_submissions']) {
        const own = await request(`/rest/v1/${table}?select=*`, token, 'GET', undefined, { Prefer: 'count=exact', Range: '0-9' });
        assert.ok([200, 206].includes(own.status)); assert.ok(own.data.length > 0); assert.ok(own.data.every(row => row.user_id === ownID));
        assert.ok(own.contentRange.endsWith('/' + own.data.length), 'RLS count excludes the other account');
        const guessed = await request(`/rest/v1/${table}?user_id=eq.${otherID}&select=*`, token);
        assert.equal(guessed.status, 200); assert.deepEqual(guessed.data, []);
      }
      const embedded = await request('/rest/v1/student_progress?select=*,progress_submissions(*)', token);
      // No public FK between tables is intentional; an embedding error is safe.
      if (embedded.ok) assert.ok(embedded.data.every(row => row.user_id === ownID && row.progress_submissions.every(r => r.user_id === ownID)));
    }
  });
  await t.test('anonymous read/write/RPC and authenticated direct mutations are denied', async () => {
    for (const table of ['student_progress', 'progress_submissions']) {
      for (const [method, body] of [['GET', undefined], ['POST', { user_id: bID }], ['PATCH', { user_id: bID }], ['DELETE', undefined]]) {
        const anonymous = await request(`/rest/v1/${table}?user_id=eq.${aID}`, null, method, body);
        assert.ok([401, 403].includes(anonymous.status));
        if (method !== 'GET') {
          const direct = await request(`/rest/v1/${table}?user_id=eq.${aID}`, A, method, body);
          assert.equal(direct.status, 403); assert.equal(direct.data.code, '42501');
        }
      }
      const upsert = await request(`/rest/v1/${table}`, A, 'POST', { user_id: aID }, { Prefer: 'resolution=merge-duplicates' });
      assert.equal(upsert.status, 403); assert.equal(upsert.data.code, '42501');
    }
    assert.ok(!(await rpc(null, 0, randomUUID(), text('anonymous'))).ok);
    assert.ok(!(await request('/rest/v1/rpc/write_progress', A, 'POST', {}, { 'Content-Profile': 'private' })).ok);
  });
  let revision = 1;
  await t.test('parallel CAS preserves both versions, and repeated requests return one receipt', async () => {
    const ids = [randomUUID(), randomUUID()], raws = [text('A laptop'), text('A phone')];
    const responses = await Promise.all(ids.map((id, i) => rpc(A, 1, id, raws[i])));
    assert.ok(responses.every(r => r.ok));
    assert.deepEqual(responses.map(r => r.data.outcome).sort(), ['accepted', 'conflict']);
    revision = 2;
    const before = await request('/rest/v1/progress_submissions?select=request_id,state_text,outcome&order=request_id', A);
    assert.equal(before.data.length, 3); assert.ok(raws.every(raw => before.data.some(r => r.state_text === raw)));
    for (const [i, id] of ids.entries()) {
      const retry = await rpc(A, 1, id, raws[i]); assert.equal(retry.data.duplicate, true);
      assert.ok(!(await rpc(A, 1, id, raws[i] + ' ')).ok);
    }
    const after = await request('/rest/v1/progress_submissions?select=request_id,state_text,outcome&order=request_id', A);
    assert.deepEqual(after.data, before.data);
    assert.ok(!(await rpc(A, 3, randomUUID(), aText)).ok);
    assert.ok(!(await rpc(A, -1, randomUUID(), aText)).ok);
    assert.ok(!(await rpc(A, 2, randomUUID(), aText, 2)).ok);
  });
  await t.test('real server envelope/Unicode/2MiB matrix, followed by full client validation', async () => {
    for (const fixture of cloudFixtures()) {
      const start = performance.now();
      const result = await rpc(A, revision, randomUUID(), fixture.text);
      assert.equal(result.ok, fixture.server, fixture.name + ': server contract differs; do not weaken compatibility to pass');
      if (fixture.server) {
        revision++;
        const head = await request('/rest/v1/student_progress?select=*', A);
        assert.equal(head.data[0].state_text, fixture.text, fixture.name + ': exact text changed');
        assert.equal(inspectRemoteProgress(head.data[0]).kind, fixture.client ? 'candidate' : 'quarantine', fixture.name);
      } else {
        const head = await request('/rest/v1/student_progress?select=revision', A);
        assert.equal(head.data[0].revision, revision);
      }
      t.diagnostic(`${fixture.name}: ${Math.round(performance.now() - start)}ms; server ${result.status}`);
    }
  });
  await t.test('invalid signature and genuinely expired session are rejected', async st => {
    const forged = A.slice(0, -8) + 'AAAAAAAA';
    for (const token of [forged, ...(env.H4_TEST_EXPIRED_JWT ? [env.H4_TEST_EXPIRED_JWT] : [])]) {
      const read = await request('/rest/v1/student_progress?select=*', token);
      assert.ok([401, 403].includes(read.status)); assert.ok(!(await rpc(token, revision, randomUUID(), aText)).ok);
    }
    if (!env.H4_TEST_EXPIRED_JWT) await st.test('genuinely expired signed JWT', { skip: 'Provide H4_TEST_EXPIRED_JWT from an expired adult test session.' }, () => {});
  });
  await t.test('server-side logout revocation invalidates still-unexpired B JWT', async () => {
    const logout = await request('/auth/v1/logout?scope=local', B, 'POST'); assert.ok(logout.ok);
    const read = await request('/rest/v1/student_progress?select=*', B);
    assert.ok([401, 403].includes(read.status) || (read.ok && read.data.length === 0));
    assert.ok(!(await rpc(B, 1, randomUUID(), bText)).ok);
  });
  t.diagnostic('Synthetic records intentionally remain for private inspection. No student records, project creation or cleanup performed.');
});
