// Actual pinned SDK in a real browser, with synthetic Auth HTTP responses.
// Proves packaging/client behavior, NOT Google/Supabase server authentication.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { serve } from './support/server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const pin = JSON.parse(await readFile(new URL('../docs/security/supabase-package.json', import.meta.url)));
const ref = 'abcdefghijklmnopqrst', project = `https://${ref}.supabase.co`;
const policy = (await readFile(new URL('../docs/security/csp-template.txt', import.meta.url), 'utf8')).trim().replace('<PROJECT_REF>', ref);

test('candidate static CSP supports five tabs and blocks external connections/inline scripts', async () => {
  const server = await serve({ transform(path, body) {
    if (path === '/' || path === '/index.html') return { body: body.toString().replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`) };
  } });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => { window.violations = []; document.addEventListener('securitypolicyviolation', e => window.violations.push(e.effectiveDirective)); });
      await page.goto(server.url + '/goal-quest/');
      for (const screen of ['home', 'week', 'goals', 'path', 'coach']) {
        await page.locator(`${width < 670 ? '#bottom-nav' : '#sidebar-nav'} [data-nav="${screen}"]`).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => window.violations), []);
      await page.evaluate(async () => {
        const script = document.createElement('script'); script.textContent = 'window.executedUnsafe=true'; document.head.append(script);
        try { await fetch('https://example.invalid/blocked'); } catch { /* expected CSP rejection */ }
      });
      assert.equal(await page.evaluate(() => window.executedUnsafe), undefined);
      await page.waitForFunction(() => window.violations.includes('script-src-elem') && window.violations.includes('connect-src'));
      await context.close();
    }
  } finally { await browser?.close(); await server.close(); }
});

test('pinned local UMD: PKCE S256, verifier-only redirect storage, exchange/refresh and cleanup (synthetic endpoints)', { skip: !process.env.H4_SUPABASE_UMD && 'Set H4_SUPABASE_UMD to the inspected temporary official UMD artifact.' }, async () => {
  const artifact = await readFile(process.env.H4_SUPABASE_UMD);
  assert.equal(createHash('sha256').update(artifact).digest('hex'), pin.browserSha256);
  const server = await serve({ transform(path, body) {
    if (path === '/' || path === '/index.html') return { body: body.toString().replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}"><script src="./vendor-spike.js"></script>`) };
  } });
  let browser, context;
  const tokens = [], requests = [], id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
    context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/vendor-spike.js', route => route.fulfill({ body: artifact, contentType: 'text/javascript' }));
    await context.route(project + '/**', async route => {
      const request = route.request(), url = new URL(request.url()); requests.push(url.pathname);
      if (url.pathname.endsWith('/token')) {
        tokens.push(request.postDataJSON());
        return route.fulfill({ json: { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600,
          user: { id, aud: 'authenticated', role: 'authenticated' }, provider_token: 'discard-provider-token' } });
      }
      if (url.pathname.endsWith('/user')) return route.fulfill({ json: { id, aud: 'authenticated', role: 'authenticated' } });
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
      throw new Error('Unexpected synthetic SDK endpoint');
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.url + '/goal-quest/');
    async function compose() {
      await page.evaluate(async ({ project }) => {
        const { createAuthFoundation } = await import('./js/cloud/auth-foundation.js');
        window.testAuth = createAuthFoundation({ config: { enabled: true, url: project, publishableKey: 'sb_publishable_synthetic', returnURL: location.origin + '/goal-quest/' },
          pageURL: location.href, temporaryStorage: sessionStorage, replaceURL: url => history.replaceState(null, '', url),
          createClient: (...args) => (window.sdkClient = window.supabase.createClient(...args)) });
      }, { project });
    }
    await compose();
    const destination = new URL(await page.evaluate(() => window.testAuth.begin({ privacyNoticeAccepted: true, safeToNavigate: true })));
    assert.equal(destination.origin, project); assert.equal(destination.searchParams.get('code_challenge_method'), 's256');
    const storage = await page.evaluate(() => ({ ...sessionStorage }));
    assert.deepEqual(Object.keys(storage), [`h4-auth-${ref}-code-verifier`]);
    const verifier = Object.values(storage)[0].replace(/^"|"$/g, '').split('/')[0];
    assert.equal(destination.searchParams.get('code_challenge'), createHash('sha256').update(verifier).digest('base64url'));
    // A real page reload discards the in-memory SDK session but retains verifier.
    await page.reload(); await compose();
    assert.deepEqual(await page.evaluate(() => window.testAuth.finish(location.origin + '/goal-quest/?code=synthetic-code')), { id });
    assert.equal(tokens[0].code_verifier, verifier); assert.equal(tokens[0].auth_code, 'synthetic-code');
    assert.equal(await page.evaluate(() => sessionStorage.length), 0);
    await page.evaluate(async () => { const { error } = await window.sdkClient.auth.refreshSession(); if (error) throw error; });
    assert.ok(tokens.some(body => body.refresh_token === 'synthetic-refresh'));
    assert.equal(await page.evaluate(() => sessionStorage.length), 0);
    const privateDisk = await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('auth') || /synthetic-access|synthetic-refresh/.test(localStorage.getItem(key))));
    assert.deepEqual(privateDisk, []);
    assert.deepEqual(await page.evaluate(() => window.testAuth.signOut()), { serverRevoked: true });
    assert.deepEqual(errors, []);
    assert.ok(requests.every(path => path.startsWith('/auth/v1/')));
  } finally { await context?.close(); await browser?.close(); await server.close(); }
});
