// B1 preparation only: deliberately not imported by app.js or the offline shell.
// The owner must approve the locally served official SDK before composition.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function authSettings(config, pageURL) {
  if (!config?.enabled) return null; // A fork without config stays entirely local.
  const project = new URL(config.url), callback = new URL(config.returnURL), page = new URL(pageURL);
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(project.origin) ||
      project.href !== project.origin + '/' || !/^sb_publishable_[\w-]+$/.test(config.publishableKey)) {
    throw new Error('Use a project URL and public publishable key only.');
  }
  if (callback.origin !== page.origin || callback.pathname !== page.pathname ||
      callback.search || callback.hash || callback.username || callback.password ||
      !(callback.protocol === 'https:' || (callback.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(callback.hostname)))) {
    throw new Error('Use an exact app return URL on this origin and path.');
  }
  return { url: project.origin, key: config.publishableKey, returnURL: callback.href,
    storageKey: `h4-auth-${project.hostname.split('.')[0]}` };
}

// SDK sessions live only in memory. Across a full redirect, sessionStorage holds
// exactly one PKCE verifier, never access/refresh/provider tokens or progress.
export function temporaryAuthStorage(storageKey, temporaryStorage) {
  const memory = new Map(), verifierKey = storageKey + '-code-verifier';
  return {
    getItem(key) { return key === verifierKey ? temporaryStorage.getItem(key) : memory.get(key) ?? null; },
    setItem(key, value) {
      if (key === verifierKey) temporaryStorage.setItem(key, value);
      else {
        if (key === storageKey) {
          const session = JSON.parse(value);
          delete session.provider_token;
          delete session.provider_refresh_token;
          value = JSON.stringify(session);
        }
        memory.set(key, value);
      }
    },
    removeItem(key) { if (key === verifierKey) temporaryStorage.removeItem(key); else memory.delete(key); },
    clear() { memory.clear(); temporaryStorage.removeItem(verifierKey); }
  };
}

export function createAuthFoundation({ config, pageURL, createClient, temporaryStorage, replaceURL } = {}) {
  const settings = authSettings(config, pageURL);
  if (!settings) return Object.freeze({ mode: 'local-only' });
  if (typeof createClient !== 'function' || typeof replaceURL !== 'function') throw new Error('Approved SDK and URL cleanup are required.');
  const storage = temporaryAuthStorage(settings.storageKey, temporaryStorage);
  const client = createClient(settings.url, settings.key, { auth: {
    flowType: 'pkce', storageKey: settings.storageKey, storage,
    persistSession: true, autoRefreshToken: true, detectSessionInUrl: false
  } });
  let generation = 0;
  async function identity(expectedGeneration = generation) {
    const { data, error } = await client.auth.getUser(); // Network-verified identity, never typed email.
    if (error || !uuid.test(data?.user?.id) || expectedGeneration !== generation) throw new Error('Sign in again to verify this account.');
    return Object.freeze({ id: data.user.id });
  }
  return Object.freeze({
    mode: 'synthetic-test-only',
    async begin({ privacyNoticeAccepted = false, safeToNavigate = false } = {}) {
      if (!privacyNoticeAccepted || !safeToNavigate) throw new Error('Review privacy and preserve pending work before leaving this page.');
      generation++;
      const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: settings.returnURL, scopes: 'openid email profile',
        queryParams: { prompt: 'select_account' }, skipBrowserRedirect: true
      } });
      if (error || !data?.url) { storage.clear(); throw new Error('Google sign-in could not start.'); }
      const destination = new URL(data.url);
      if (destination.origin !== settings.url || destination.pathname !== '/auth/v1/authorize') {
        storage.clear(); throw new Error('Unexpected sign-in destination.');
      }
      return destination.href; // Caller owns the explicit navigation after preserving work.
    },
    async finish(callbackURL) {
      const attempt = ++generation, callback = new URL(callbackURL);
      if (callback.origin + callback.pathname !== settings.returnURL) throw new Error('Unexpected callback path.');
      const code = callback.searchParams.get('code');
      // No token or provider error text enters rendering, logs or outgoing links.
      replaceURL(settings.returnURL);
      try {
        if (!code || callback.searchParams.has('error') || callback.hash) throw new Error('Sign-in was not completed.');
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) throw new Error('Sign-in was not completed.');
        return await identity(attempt);
      } catch {
        storage.clear();
        throw new Error('Sign-in was not completed. Your local progress is unchanged.');
      } finally { storage.removeItem(settings.storageKey + '-code-verifier'); }
    },
    identity,
    async signOut() {
      generation++;
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        return { serverRevoked: !error };
      } catch { return { serverRevoked: false }; }
      finally { client.auth.stopAutoRefresh(); storage.clear(); }
    }
  });
}
