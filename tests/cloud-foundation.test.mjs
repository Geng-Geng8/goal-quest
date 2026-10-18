import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createAuthFoundation, temporaryAuthStorage, authSettings } from '../js/cloud/auth-foundation.js';
import { inspectRemoteProgress, prepareProgressText } from '../js/cloud/validate-progress.js';
import { createStore, KEY, RECOVERY_KEY } from '../js/state.js';
import { emptyState, parseBackup } from '../js/data-safety.js';
import { cloudFixtures, migratedLegacyFixtures } from './support/cloud-fixtures.mjs';

const config = { enabled: true, url: 'https://abcdefghijklmnopqrst.supabase.co', publishableKey: 'sb_publishable_synthetic', returnURL: 'https://example.test/goal-quest/' };
const memory = () => {
  const data = new Map();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
};
test('missing configuration never loads an SDK or accesses storage/network', () => {
  assert.deepEqual(createAuthFoundation(), { mode: 'local-only' });
  assert.deepEqual(createAuthFoundation({}), { mode: 'local-only' });
  assert.deepEqual(createAuthFoundation({ config: { enabled: false }, createClient() { assert.fail(); } }), { mode: 'local-only' });
});
test('public config rejects secrets, alternate origins, paths and open redirects', () => {
  assert.equal(authSettings(config, config.returnURL).returnURL, config.returnURL);
  for (const overrides of [{ publishableKey: 'sb_' + 'secret_example' }, { publishableKey: 'legacy-jwt' },
    { returnURL: 'https://evil.test/' }, { returnURL: config.returnURL + '?next=https://evil.test' },
    { returnURL: 'https://example.test/sibling/' }, { url: 'https://user:pass@abcdefghijklmnopqrst.supabase.co' }]) {
    assert.throws(() => authSettings({ ...config, ...overrides }, config.returnURL));
  }
});
test('only the SDK PKCE verifier crosses redirect; tokens remain in memory', () => {
  const disk = memory(), storage = temporaryAuthStorage('auth-test', disk);
  storage.setItem('auth-test-code-verifier', 'synthetic-verifier');
  storage.setItem('auth-test', JSON.stringify({ access_token: 'synthetic', refresh_token: 'synthetic', provider_token: 'drop', provider_refresh_token: 'drop' }));
  assert.deepEqual([...disk.data.keys()], ['auth-test-code-verifier']);
  assert.equal(JSON.parse(storage.getItem('auth-test')).provider_token, undefined);
  const reloaded = temporaryAuthStorage('auth-test', disk);
  assert.equal(reloaded.getItem('auth-test'), null);
  assert.equal(reloaded.getItem('auth-test-code-verifier'), 'synthetic-verifier');
  storage.clear(); assert.equal(disk.data.size, 0); assert.equal(storage.getItem('auth-test'), null);
});
test('auth orchestration uses PKCE, minimum identity scopes and verified UUID only (SDK stub, not OAuth proof)', async () => {
  const disk = memory(), cleaned = [], calls = []; let options;
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const auth = createAuthFoundation({ config, pageURL: config.returnURL, temporaryStorage: disk, replaceURL: u => cleaned.push(u),
    createClient(url, key, opts) {
      options = opts;
      return { auth: {
        async signInWithOAuth(request) { calls.push(request); return { data: { url: config.url + '/auth/v1/authorize?synthetic=1' } }; },
        async exchangeCodeForSession(code) { assert.equal(code, 'synthetic-code'); return {}; },
        async getUser() { return { data: { user: { id, email: 'unused@example.test' } } }; },
        async signOut() { return { error: true }; }, stopAutoRefresh() {}
      } };
    }
  });
  assert.equal(options.auth.flowType, 'pkce'); assert.equal(options.auth.detectSessionInUrl, false);
  await assert.rejects(auth.begin());
  await auth.begin({ privacyNoticeAccepted: true, safeToNavigate: true });
  assert.equal(calls[0].options.scopes, 'openid email profile');
  assert.deepEqual(calls[0].options.queryParams, { prompt: 'select_account' });
  assert.deepEqual(await auth.finish(config.returnURL + '?code=synthetic-code'), { id });
  assert.deepEqual(cleaned, [config.returnURL]);
  assert.deepEqual(await auth.signOut(), { serverRevoked: false });
  assert.equal(disk.data.size, 0);
});
test('a late verified identity cannot complete after sign-out (orchestration only)', async () => {
  let release;
  const auth = createAuthFoundation({ config, pageURL: config.returnURL, temporaryStorage: memory(), replaceURL() {},
    createClient: () => ({ auth: { getUser: () => new Promise(resolve => { release = resolve; }), signOut: async () => ({}), stopAutoRefresh() {} } }) });
  const pending = auth.identity(); await auth.signOut();
  release({ data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } } });
  await assert.rejects(pending);
});
const v4 = JSON.parse(readFileSync(new URL('./fixtures/v4-save.json', import.meta.url)));
for (const fixture of [...cloudFixtures(), ...migratedLegacyFixtures(v4)]) {
  test(`incoming boundary: ${fixture.name}; server expectation ${fixture.server ? 'accept' : 'reject'} is NOT database-tested here`, () => {
    const disk = memory(); disk.setItem(KEY, JSON.stringify(emptyState())); disk.setItem(RECOVERY_KEY, 'unchanged recovery bytes');
    const store = createStore(disk), previous = [...disk.data], previousState = structuredClone(store.state);
    const result = inspectRemoteProgress({ state_text: fixture.text, revision: 1, protocol_version: 1, data_version: 8 });
    assert.equal(result.kind, fixture.client ? 'candidate' : 'quarantine');
    if (fixture.client) {
      assert.equal(result.raw, fixture.text);
      assert.deepEqual(parseBackup(result.backup).state, result.state);
      assert.deepEqual(JSON.parse(prepareProgressText(result.state)), result.state);
    } else { assert.equal(result.raw, fixture.text); assert.equal(result.observedRevision, 1); }
    assert.deepEqual([...disk.data], previous); assert.deepEqual(store.state, previousState);
  });
}
test('unsupported cloud envelope is quarantined without migration/adoption', () => {
  for (const fields of [{ revision: 0 }, { revision: 9007199254740992 }, { protocol_version: 2 }, { data_version: 9 }]) {
    assert.equal(inspectRemoteProgress({ state_text: JSON.stringify(emptyState()), revision: 1, protocol_version: 1, data_version: 8, ...fields }).kind, 'quarantine');
  }
});
test('B1 is absent from the runtime shell, and committed public sources contain no secret key or privileged JWT', () => {
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app + sw, /cloud\/|supabase|auth-foundation/);
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n');
  for (const name of new Set(files)) {
    if (/\.(?:png|ico|woff2?|jpg|zip|tgz)$/.test(name)) continue;
    const text = readFileSync(name, 'utf8');
    assert.doesNotMatch(text, /sb_secret_[A-Za-z0-9_-]{12,}/, name);
    assert.doesNotMatch(text, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, name);
    for (const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
      assert.notEqual(payload.role, 'service_role', name);
    }
  }
});
