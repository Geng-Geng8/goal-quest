/* H4 Goal Quest: static files only. Regenerate the release table with
 * node tools/update-offline-cache.mjs after changing any shell file. */
// RELEASE START
const RELEASE = 'db1bd33780761cfc';
const ASSETS = {
  "./icons/apple-touch-icon.png": "c83b21becc3cc03583fae1abb5c19290a1f64185c4655320a3a9bda6f82d372c",
  "./icons/brandmark.svg": "e29d863330c760be7437a62a5e1589d68cdd7396fa1e161ca86cb2015f984923",
  "./icons/icon-192.png": "878ac83580df773ea34f474108d6a3de1d0e91e5b68cf8a5e047a20888c4e0d7",
  "./icons/icon-512.png": "8edeac45b6209d6d72166b5eec323abadde5ea4a0973d070014e16b4aa3c84ce",
  "./icons/maskable-512.png": "0457fc61575ceb783af057f7a5b1f66e4d3c601df77bccec39dadf1911dfadf5",
  "./index.html": "52e3434ac40663d2956a5f209ebdf7abc8175a9962cd0359df975abdcc72c723",
  "./js/academy-coach.js": "0aaa92213d31913b3c6a0f7adef4584b896746dc1c59a4d730b5a46b8d601cca",
  "./js/app.js": "c158c826307ead0176a2dc5f2c7b0ccb646bd9e85da1c61dd8a32c512ce16f31",
  "./js/companion-controls.js": "f46ab19a919fb85a71276f51dff636a57cceacd8c07b2acb4cba423edce9e814",
  "./js/companions.js": "1b1058be20e1346b3ffd659988fb7c51b8ac1c24855719ee8c6f535b41a29a91",
  "./js/creator-smart.js": "956584aa83621a5321d4d9fce0b2ae65196f63825f988f8a0e6ef3b1d7d1207d",
  "./js/data-controls.js": "c3a48d3c27c87ead587d814e4034b59fea579aa4f0c6fece678b93e9c2bb722c",
  "./js/data-safety.js": "8504620368c5cd93a76ba8722d44c51550b7cdf954f06d73f760d946dca7abf7",
  "./js/focus-timer.js": "146a19b18f4c994a2c9af78167f128ef6e5a87580bcb93476205f967096f7c5a",
  "./js/gameplay.js": "43e614a51d0e3cde81243a5944f65c09e32ebddecc2b5e762ee8cf5710e74239",
  "./js/goal-collection.js": "e790d7c9a8afdcd89f1cae76d34b65bba7d49800c609ce463ebc2c6c7f1cf9e9",
  "./js/goal-status.js": "d27129c629943a82842cec9e426dce519dc0281ebbb4543b9a95e8d61117e3ad",
  "./js/planner.js": "07608e799a8d39286e12600cf689983232a0373bcd13a0cc61f387d12b9f7aed",
  "./js/pwa.js": "829257be958c5b2b82677b79f247b9a4fdc68378940e267ae5dd2fe30314c20f",
  "./js/state.js": "360460cc8068bd9459ffbf87a71b211598bedb2fd071d76f9c05c16a15819144",
  "./js/ui.js": "34a517d8bf940b6759d28088fd4353fe27efdf7ad6ae7530047e0a3f713ba394",
  "./manifest.webmanifest": "a1be2ff1b1bca0b45a9c8afa2774fea44469bcc94e87f60007044bf1ebf87dd3",
  "./styles.css": "eab9c1ed354c5c3af8d66152f3eb5cfe9019e1864059e13810e89e181baf5169"
};
// RELEASE END

const BASE = new URL('./', self.location.href);
const PREFIX = `h4-goal-quest-shell:${BASE.pathname}:`;
const CACHE = PREFIX + RELEASE;
const urls = Object.entries(ASSETS).map(([path, hash]) => [new URL(path, BASE).href, hash]);

async function verified(response, hash) {
  if (!response || !response.ok || response.redirected) throw new Error('Incomplete offline download');
  const bytes = await response.clone().arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  if (actual !== hash) throw new Error('Offline file does not match this release');
  return response;
}
async function check(cache) {
  for (const [url, hash] of urls) await verified(await cache.match(url), hash);
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // An identical release may already be active. Never alter/delete its cache.
    const existing = (await caches.keys()).includes(CACHE);
    const cache = await caches.open(CACHE);
    if (existing) return check(cache);
    try {
      for (const [url, hash] of urls) {
        const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin', redirect: 'error' }));
        await cache.put(url, await verified(response, hash));
      }
      await check(cache);
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    // Intentionally no skipWaiting: an update cannot interrupt any open student
    // window, even if another window requests an update. No mixed module versions.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await check(await caches.open(CACHE));
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    // No clients.claim: a page already loading from the network finishes there.
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin) return;
  const shell = request.mode === 'navigate' &&
    (url.pathname === BASE.pathname || url.pathname === new URL('index.html', BASE).pathname);
  const key = shell ? new URL('index.html', BASE).href : url.href;
  if (!urls.some(([asset]) => asset === key)) return;
  event.respondWith((async () => {
    try {
      // Never fill a missing old-release file from a newer network deployment.
      return await (await caches.open(CACHE)).match(key) || Response.error();
    } catch { return Response.error(); }
  })());
});
