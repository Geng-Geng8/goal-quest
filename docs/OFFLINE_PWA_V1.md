# Phase 6 — Installation & Offline V1

Branch: `feature/offline-pwa-v1`, from latest `origin/main` at `cdf8368` (Phase 5). Review only: no merge, deployment, Pages configuration or Phase 7 work.

## Student experience

Visit online once and leave the page open until **Install & offline · ready** appears. A first-ever visit without internet cannot download the app. After setup, the same browser/profile can open and refresh the app offline, including an installed launch at its start URL. All five tabs and existing local student tools remain available. No install is required to use the browser version.

**Install & offline**, beside the existing backup button, explains browser-specific installation and updates. It opens the existing accessible dialog and never appears automatically. There are no repeated install prompts, new tabs, automatic offline popups, permission requests or gameplay changes. A small polite message appears for a waiting update or failed setup/check. Installation menus and availability depend on browser, OS and device policy; iOS Safari uses its Share menu rather than Chromium's native installation prompt. See [Apple's Safari instructions](https://support.apple.com/guide/iphone/iphea86e5236/ios) and [Chrome's installation instructions](https://support.google.com/chrome/answer/9658361).

When an update is ready, finish and save forms, then **close every Goal Quest browser tab and installed app window and reopen when ready**. A normal refresh is not a promise to activate an update: the current window or another open window can keep the old worker alive. There is deliberately no force-update/reload button. A running timer keeps its saved deadline, but cannot sound an alarm while closed. If saving failed, keep the page open and download a full backup before closing.

Installing is not a permanent backup. Browser/OS cleanup, site-data clearing, profile changes, private browsing, device loss and uninstall options can remove data. Installed apps may have separate storage on some platforms; verify progress after installation and use a private backup to transfer it when necessary. No automatic sync is supplied.

## Implementation and boundaries

- `manifest.webmanifest`: H4 Goal Quest / Goal Quest, standalone display, existing navy theme and light background, relative `id`, `start_url` and `scope` of `./`. Works at localhost `/` and future HTTPS `/goal-quest/` without a site-root asset path.
- `icons/`: 192px/512px PNGs, an opaque 512px maskable icon and opaque 180px Apple touch icon. They reuse the current rounded violet-to-mint brandmark and white four-point star. The maskable star fits within the central safe circle. `brandmark.svg` is the editable source, not a new logo system. Apple metadata and local favicon are in `index.html`.
- `sw.js`: one classic worker, scoped to its own directory. A checked-in release table contains SHA-256 hashes for all **23** local shell files: HTML, CSS, all 15 ES modules, manifest and five icon/source files. Worker updates are fetched by the browser; the worker script is not intercepted or cached as shell content. No documentation, reference fixture, test data, downloaded backup, personal record or third-party response is cached.
- Installation fetches fresh same-origin files, rejects HTTP failures/redirects or unexpected bytes, writes a new versioned cache, then verifies every cached response. Any download, verification or quota failure rejects installation and removes only that attempt's new cache. The existing release stays intact. An identical existing release is checked without modifying/deleting its cache.
- Controlled navigations to the app directory or `index.html` (including query parameters) use cached HTML. Exact allowlisted static requests use the same release cache. Other requests are untouched. Unknown paths do not silently become app pages. All essential features and artwork are local; the Coach only supplies copyable prompts, while using an external LLM still needs its own connection.
- No `skipWaiting`, `clients.claim`, forced reload or background synchronization. A verified update waits for **all** existing clients to close. This uses the browser's normal [service worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), keeping an open app's entire module graph on one release. Activation verifies the new cache again before removing obsolete caches with this exact app-directory prefix. Other scopes/apps' caches remain untouched.
- Requests never fill a missing old-release file with an unverified newer network file. A cache miss tries the exact allowlisted URL with HTTP-cache reload and redirects rejected; the active worker's SHA-256 must match before any returned bytes are used or cached. Offline, HTTP errors, redirects and mismatched files fail closed. Reconnect and reload to recover missing HTML/modules when the matching release is available; no unregister or student-data reset is needed. Simultaneous requests share one repair per URL and get separate readable response bodies. Failed attempts are removed from the pending map so later requests can retry. Recovery never deletes caches or falls back to a different release.
- If cache access/writing fails, verified responses remain usable online without pretending they were saved offline. The existing installation status asks the active worker to verify its complete cache through a bounded, read-only message check; missing files, cache errors or no reply produce an incomplete-offline message instead of “ready.” Late replies cannot replace a newer status. Freeing space and reloading retries missing files. Cache loss/eviction is still possible, and recovery requires exact current-release bytes: if the server only has incompatible newer files, requests remain blocked until a complete verified update can activate through the existing close/reopen flow. **Do not clear localStorage/site data** to repair a shell. Keep private backups.
- `js/pwa.js` owns installation help and worker status only; `app.js` remains the composition root. Unsupported/blocked worker registration leaves online workflows and backups usable. Browser-managed update checks occur on navigation; the help dialog also has a manual check. There is no polling service or third-party request.

The existing storage key **`h4_goal_quest_v4`**, schema **8**, V4–V8 imports, exact recovery originals, validation/size limits, stale-save protection, XP, timer controller, companion families/28 forms and all student state structures are unchanged. Cache lifecycle code cannot read or write localStorage. Existing storage failure warnings and unsaved-work exports stay authoritative; shell readiness does not mean student progress saved successfully.

## Release maintenance

This remains a zero-build app: serve the checked-in files directly. No package install, build command or runtime dependency is needed.

When a shell file changes, run `node tools/update-offline-cache.mjs` and commit `sw.js` **with** those changes. This maintenance command discovers local JS/icon files and updates only the checked-in digest table and content-derived release ID. It is not run in the browser or required by hosting. The Node suite fails if files/hashes drift. If only worker logic changes, its changed script bytes still trigger the normal worker update lifecycle; an identical asset table can safely reuse its verified cache.

`.gitattributes` fixes hashed text assets to **LF** and marks PNGs binary. This matters on Windows with `core.autocrlf=true`: release hashes must match the bytes committed to Git and served by GitHub Pages. The generator rejects CRLF assets rather than publishing different local/hosted digests. Normalize an existing checkout to the declared endings if necessary. The frozen V4 reference is unchanged.

Optional artwork maintenance uses `tools/render-icons.mjs` with an already available Playwright/Edge runtime; the PNGs are committed. Do not install a runtime just to run or host the app.

For a future approved deployment, publish all release files together over HTTPS. Keep the worker in the project directory; do not broaden its scope or use DevTools' skip-waiting/update-on-reload overrides during student testing. If deployment is incomplete, hashes reject the update and students keep their previous cache. For rollback, restore a complete reviewed release and its matching worker/table; do not change student records or delete their storage. Closing/reopening is still required to activate the rollback. No deployment is authorized by this report.

## Automated verification

Tests use isolated browser profiles, synthetic records, and loopback static hosting. No real student information or production records are used.

| Check | Result / coverage |
| --- | --- |
| Existing Node baseline before changes | 77 passed |
| `node --test tests/*.test.mjs` | 94 passed; all previous coverage retained, including 17 manifest/cache lifecycle/recovery tests |
| All six browser suites in installed Edge | 69 passed, including all 56 existing browser regressions and 13 offline/install/recovery checks |
| Offline suite in installed Chrome | 13 passed |
| Syntax and diff checks | All 31 app/worker/maintenance/test JavaScript files passed `node --check`; `git diff --check` passed; all 23 staged Git blobs match the release hashes |
| Frozen reference and data/gameplay modules | Frozen hash and all 28 default SVGs still tested; no functional changes to storage, validation, gameplay or timer modules |

`tests/offline-pwa.test.mjs` executes the actual worker handlers with controlled fetch/cache failures. It verifies complete asset/hash coverage, manifest and PNG dimensions, relative project paths, cached navigation, allowlisting, failed/mismatched downloads, blocked/full CacheStorage, same-release safety, verification before cleanup, path-isolated cleanup and fail-closed behavior after asset loss.

`tests/offline-pwa.browser.mjs` uses real installed workers at **`/` (375px)** and **`/goal-quest/` (1365px)**. It verifies offline index/query navigation, five tabs, draft autosave/refresh, SMART creation/editing, SMART+/WOOP, action completion/undo/re-completion with once-only XP, rescheduling, companion customization/evolution, parking/reactivation/achievement, journal/check-in, lessons/Wheel, prompt preview, paused/running timer persistence, actual JSON download/import, recovery preservation and reopening in the same profile. The server rejects requests while disconnected in addition to Playwright's offline flag. Chromium's browser-process worker-script update checks can bypass that flag; only `/sw.js` checks are allowed and rejected by the test server. Essential shell files and interactions use no network while disconnected, and cached static text contains none of the synthetic student's private extension.

The update test serves missing and mismatched new files, proves the old app still reloads offline, then serves a valid changed stylesheet/release. Two windows remain on the old cache while a goal form and timer are active. Refresh does not force activation. After all clients leave, the new shell activates, cleans obsolete caches, preserves student progress/timer and reloads offline. A separate real Chromium quota override of one byte proves failed initial cache setup leaves the online app and backup access usable with a clear warning. Registration failure and offline localStorage write failure are tested separately; unsaved progress still downloads in full.

Chromium manifest/installability diagnostics report no errors for either path in disposable regular browser profiles. Private automation profiles report `in-incognito` by design, so a separate regular-profile test is used. These diagnostics do not claim that the OS installation UI or physical home-screen launch has been exercised.

Existing browser suites retain their console/error, overflow, keyboard/dialog, reduced-motion, migration/recovery/size-limit and V4 workflow checks. Only four old toolbar selectors now name the backup action explicitly, since the toolbar also contains the installation-help button. The shell parity normalization explicitly excludes new PWA metadata/notice; all other comparisons remain.

Installed browsers exercised: **Microsoft Edge 155.0.4283.45** and **Google Chrome 155.0.8059.79**, headless on Windows. Existing Playwright was reused, with no downloaded packages/engines. Firefox and WebKit launch probes reported missing executables (`firefox-1538`, `webkit-2336`). They did not pass. Screens are emulated; actual app-install UI, standalone launch, physical iOS/Android, Safari/Firefox, assistive technologies and OS uninstall behavior remain **unverified**. Automated page close/reopen uses the same isolated browser profile; it does not claim an OS reboot or physical installed-app test. Installation-help phone/desktop screenshots and the maskable artwork were visually inspected.

```powershell
node --test tests/*.test.mjs
$env:PLAYWRIGHT_MODULE_PATH = 'C:/path/to/existing/node_modules/playwright'
$env:BROWSER_CHANNEL = 'msedge'
node --test tests/browser.mjs tests/data-safety.browser.mjs tests/goal-collection.browser.mjs tests/companion-gameplay.browser.mjs tests/accessibility-stability.browser.mjs tests/offline-pwa.browser.mjs
$env:BROWSER_CHANNEL = 'chrome'
node --test tests/offline-pwa.browser.mjs
git diff --check
```

If another engine is already available, set `BROWSER_ENGINE=firefox` or `webkit` for the new offline suite. Its real quota and installability diagnostics use Chromium CDP and are explicitly skipped on other engines. Do not treat skipped checks as passes.

## Manual installation checklist — not yet completed

Record device, OS/browser version, date, test URL, and pass/fail notes. Use only synthetic goals. Use an owner-approved HTTPS test host: `http://localhost` on a phone means that phone, and a plain HTTP LAN address is not a secure context for workers. This phase does not publish a test host or enable Pages. Confirm the eventual project URL ends in `/goal-quest/`.

### Android Chrome

1. Visit online in Chrome; wait for **Install & offline · ready**. Create a synthetic goal/action and download a private full JSON backup.
2. Use Chrome's menu → **Install app** or **Add to Home screen**, then confirm. Menu wording may vary. Launch from its icon; verify name, star artwork, standalone layout, five tabs and your saved goal. If progress is separate, import the backup after reviewing its preview.
3. Enable airplane mode and disable Wi-Fi too. Close the app, reopen from its icon, then refresh. Create/edit a goal, park/reactivate it, complete/undo/re-complete an action, reschedule another, customize a companion, add a journal/check-in, read a lesson and start a timer. Check no duplicate XP. Follow the offline backup checklist below.
4. Close/reopen again offline: verify goals, notes, XP, companion appearance and timer deadline/paused state. Return after a running timer expires; completion should appear on return, without promising a closed-app alarm.
5. Reconnect. With an approved newer test release available, use **Install & offline → Check offline setup & updates**. Keep a goal form and another app tab open: neither should refresh. Finish/save, close every app window/tab, then reopen. Verify the update, saved progress and offline launch again.

### iPhone Safari

1. Visit online in Safari; wait for readiness and download a synthetic backup using Files. Use Safari's **Share → Add to Home Screen**. Keep **Open as Web App** enabled if shown, then tap **Add**. There is no Chromium `beforeinstallprompt` install flow on iOS. [Apple documents these steps](https://support.apple.com/guide/iphone/iphea86e5236/ios).
2. Launch the home-screen icon. Verify the icon/name, standalone view, safe-area bottom navigation and progress. Check storage rather than assuming the browser and installed app share it; restore your synthetic backup if necessary. Allow this installed context to finish offline setup online.
3. Enable airplane mode with Wi-Fi off. Close the installed app via the app switcher and reopen. Repeat Android step 3 and the offline backup checklist using Files; check touch/keyboard/form scrolling in portrait and landscape.
4. Close/reopen and confirm progress and timer. Reconnect and check for an approved test update. Keep a form open while it waits; then save, close **all** Safari app tabs and installed windows via the app switcher, and reopen. Confirm the update and another offline launch. OS suspension/worker timing can delay activation; if the old version remains, finish closing other contexts and reopen again.

### Desktop Chrome / Edge

1. Visit the approved HTTPS URL (or localhost); wait for readiness. Save synthetic goals and download a backup.
2. Choose the address-bar install icon or browser-menu install action and confirm. Launch the installed app; verify standalone appearance, icon, navigation and progress.
3. Disconnect networking. Close all app windows and open it from the installed shortcut; refresh and repeat the core offline interactions above. Verify no browser offline error page. Close/reopen and confirm the saved goal, XP and timer. Also test the ordinary browser URL offline.
4. Reconnect with an approved newer test release. Check for an update while a form, running timer and second window are open. Do not use DevTools force-update overrides. Confirm nothing reloads. Save, close every window/tab, reopen and verify the new version plus preserved data. Disconnect/reopen once more.

### Offline backup, restore and recovery — every device

1. While offline, add a distinctive synthetic note and pause a timer. **Back up & restore → Download full backup**. Confirm the JSON file is actually available in Downloads/Files locally; an online-only cloud file is not an offline backup.
2. Make another synthetic change. Import the downloaded local JSON; inspect the preview, cancel once, and verify the newer change remains.
3. Import again and confirm replacement. Verify the earlier goal/companion/note/timer; close/reopen offline and check it persists. **Review recovery copy**, confirm, and verify the change from before import can be recovered.
4. Reconnect; verify nothing was uploaded or synced and both backups remain under your control. Keep downloaded backups private. Repeat with storage restricted in a disposable profile: follow save warnings, retain the page and download unsaved work before closing.

### Removal and data-loss check — disposable data only

1. Download a full backup and verify it can be selected locally **before** uninstalling or clearing anything.
2. Remove the installed app. Read any browser/OS option to delete its data; removal and site-data behavior differ by platform. Do not assume removing just the icon guarantees progress is kept, or that reinstall restores it.
3. Revisit/reinstall online, check whether data remains, and restore the private synthetic backup if needed. Clearing browser/site data can remove both primary and recovery records as well as offline files. Installation does not prevent this loss.

## Changed files and remaining review boundary

- `.gitattributes`, `index.html`, `styles.css`, `js/app.js`: stable release bytes, metadata, compact install-help entry/status and composition.
- `manifest.webmanifest`, `sw.js`, `js/pwa.js`: new install/offline lifecycle and guidance.
- `icons/brandmark.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`, `icons/apple-touch-icon.png`: local installation artwork.
- `tools/update-offline-cache.mjs`, `tools/render-icons.mjs`: optional checked-in release/artwork maintenance.
- `tests/offline-pwa.test.mjs`, `tests/offline-pwa.browser.mjs`: focused offline/update tests.
- `tests/modules.test.mjs`, `tests/accessibility-stability.browser.mjs`, `tests/support/server.mjs`: explicit PWA shell allowances, precise backup selectors, manifest/image MIME types and test-only update simulation.
- `README.md`, this report: usage, verification, release maintenance, installation checklist and limitations.

Remaining risks are browser storage eviction/quota, device-specific installation/storage/uninstall behavior, update timing while other clients remain open, and untested physical devices/engines. Keep private backups and complete the manual installation checklist before a pilot release. Review the draft PR before any merge, deployment, Pages enablement or Phase 7 work.

## PR #6 review correction — recovery after cache loss

Addressed the [latest owner review](https://github.com/Geng-Geng8/goal-quest/pull/6#issuecomment-6243059290) on the existing `feature/offline-pwa-v1` branch. The original worker failed every cache miss indefinitely, including after reconnecting. Eight targeted Node regressions failed against that implementation before the correction. The fetch handler now repairs only missing, allowlisted current-release files with the same SHA-256 verification used for installation. Cache-write failures preserve verified online use while the status check explicitly withholds offline readiness. Existing cache hits, installation rollback, safe activation, waiting updates and student storage protections are unchanged.

Only `sw.js`, `js/pwa.js`, `tests/offline-pwa.test.mjs`, `tests/offline-pwa.browser.mjs` and this report change in the correction. The checked-in release table was regenerated because the status module changed. No state/schema/key, backup/recovery validator, gameplay, XP, companion, timer, educational content, accessibility flow, hosting or deployment change is included.

The eight added Node tests cover both app paths, offline missing index/modules followed by exact-byte online repair, failed downloads, redirects, hash mismatches, retry after failure, eight simultaneous requests with independent bodies, blocked cache access and quota failure. They preserve the current cache's unaffected contents and any previous cache; the worker never deletes a cache during recovery. The previous missing-asset test now explicitly simulates offline failure, retaining its same-release-reinstall assertions.

Six added real-browser tests run in both Edge and Chrome, at `/` and `/goal-quest/`. Each uses a complete existing cache plus another complete prior cache, synthetic saved progress, a real downloaded/imported backup and the resulting recovery record. They remove `index.html` and `js/planner.js`, exercise actual offline navigation failure, reconnect and reload successfully, then verify all cached hashes and exact primary/recovery bytes. Overlapping requests are held at the test server to verify one download with eight readable responses. Mismatched newer JavaScript and 404s are rejected without changing either cache or student data, and a later matching response repairs successfully. Chromium's actual one-byte quota override proves the app can reopen online from verified bytes while cache writes fail: the offline warning is visible, “ready” is absent, backups still download correctly, and offline reopening continues to fail safely. Restoring quota and reconnecting allows repair and subsequent offline reopening without a storage reset.

Final verification uses the commands above: **94 Node tests**, all six browser suites in Edge (**69 tests**) and the full offline suite in Chrome (**13 tests**). The final results are recorded in the table. The existing browser/device limitations remain: physical phones, Safari/Firefox and native install/uninstall UI are unverified. When only newer incompatible files remain on the server, this correction deliberately refuses to repair an old release with those bytes; a complete verified update must activate normally. Stop for final draft-PR review; no merge, deployment, Pages enablement or Phase 7 work.
