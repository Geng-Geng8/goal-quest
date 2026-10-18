# H4 Goal Quest

H4 Goal Quest is a vanilla ES-module app with no build step. Phase 6 adds installation metadata and a verified offline shell, preserving the existing student data, gameplay, timer and accessibility protections. See [Offline PWA V1](./docs/OFFLINE_PWA_V1.md) for implementation, browser coverage, release maintenance and manual installation checks. Earlier quality work is documented in [Accessibility & Stability V1](./docs/ACCESSIBILITY_STABILITY_V1.md).

## What's here

- `index.html` — original app shell, loading `./styles.css` and `./js/app.js`.
- `styles.css` — V4 design plus data-safety, companion and accessibility adjustments.
- `js/app.js` — the only composition root; navigation and delegated events.
- `js/state.js` — local saved state, atomic replacement, recovery copies, demo defaults and date/ID helpers.
- `js/data-safety.js` — complete backup format, strict validation and additive V4–V7 → V8 migration.
- `js/goal-status.js`, `js/goal-collection.js` — goal states, focus choices, achievement and celebration.
- `js/data-controls.js` — backup/import/recovery dialogs and save warnings.
- `js/companions.js` — seven original families/SVGs, per-goal appearance, evolution, player level and momentum.
- `js/gameplay.js` — legacy XP compatibility, one-time task/plan rewards and daily check-in credit.
- `js/companion-controls.js` — optional nickname/style preview and accessible evolution dialogs.
- `js/creator-smart.js` — goal collection/detail, five-step creator, draft and goal editing.
- `js/planner.js` — Today, My Week, tasks, check-in, persistent timer and calendar reminder.
- `js/focus-timer.js` — wall-clock timer controller, independent of rendering and storage APIs.
- `manifest.webmanifest`, `icons/` — relative installation metadata and existing star brandmark in home-screen sizes.
- `sw.js`, `js/pwa.js` — versioned, verified static offline shell and student installation/update guidance.
- `tools/update-offline-cache.mjs` — optional release maintenance; updates the checked-in asset hashes after shell changes.
- `js/academy-coach.js` — six lessons, Wheel, SMART+/WOOP activities and copyable prompts.
- `js/ui.js` — escaping, shared modal focus/keyboard lifecycle, toast, clipboard and download utilities.
- `reference/capstone_quest_v4.html` — **do not edit**; regression baseline.
- `docs/H4_Goal_Quest_V1_Complete_Product_Brief.md` — complete product vision; distinguishes working, planned and future features.
- `AGENTS.md` — constraints for Codex / Antigravity.
- `docs/PHASE_1_2_CODEX_PROMPT.md` — ready-to-paste implementation assignment.
- `tests/baseline.test.mjs` — no-dependency integrity/syntax check for the frozen baseline.
- `tests/modules.test.mjs` — no-dependency structural, data and pure-function parity checks against V4.
- `tests/browser.mjs` — optional full browser comparisons against V4 at 375, 390 and 1365px.
- `tests/data-safety.test.mjs` — backup, validation, migration, cancellation, recovery and storage-failure tests.
- `tests/data-safety.browser.mjs` — optional real-browser backup/restore tests, including an actual V4 download.
- `tests/goal-collection.test.mjs`, `tests/goal-collection.browser.mjs` — lifecycle, legacy archives, achievement, migration and responsive interaction checks.
- `tests/companion-gameplay.test.mjs`, `tests/companion-gameplay.browser.mjs` — reward integrity, identity, evolution, momentum, migration, backup and accessible responsive flows.
- `tests/accessibility-stability.test.mjs`, `tests/accessibility-stability.browser.mjs` — timer, local days/DST, migration, keyboard, labels, contrast and responsive checks.
- `tests/offline-pwa.test.mjs`, `tests/offline-pwa.browser.mjs` — install metadata, complete shell caching, offline student workflows and safe updates/failures.
- `docs/COMPANION_GAMEPLAY_V1.md` — Phase 4B behavior, schema, verification and trade-offs.
- `docs/GOAL_COLLECTION_V1.md` — Phase 4A behavior, schema, verification and known limitations.
- `tests/fixtures/` — synthetic V4 save/export captured from the frozen prototype.
- `docs/STUDENT_DATA_SAFETY.md` — student instructions, format, safety contract and Phase 3 verification.
- `docs/PHASE_1_2_VERIFICATION.md` — validation results and existing limitations.
- `.nojekyll` — GitHub Pages compatibility.

## Run on your computer

1. Open this folder in Antigravity, Codex, VS Code or a terminal.
2. Start a local static server, for example:
   - **Windows:** `py -m http.server 8000`
   - **macOS / Linux:** `python3 -m http.server 8000`
3. Visit `http://localhost:8000/` in your browser.
4. Run the no-dependency checks with Node.js 22 or newer: `node --test tests/*.test.mjs`.

Use HTTP rather than opening `index.html` as a local file, because native modules require a static server. All app asset paths are relative, including when hosted under a project subdirectory.

Data is saved **only in your browser**, under the key `h4_goal_quest_v4`. It is not synced. Browser data can be lost, so do not use this pre-pilot build for important long-term student records.

## Installation and offline use

Visit online once and keep the app open until **Install & offline · ready** appears. Then this browser can reopen and refresh the app offline. The same five tabs, goals, planner, lessons, companions, timer and backup tools stay available. Installation is optional; use **Install & offline** beside the backup button for Android Chrome, iPhone Safari and desktop Chrome/Edge instructions. iPhone installation uses Safari's Share menu rather than a Chromium installation prompt.

Verified updates wait until every app window and Goal Quest browser tab closes. Finish/save open forms, download a backup if saving failed, then close and reopen when ready. No update forces a reload. Installing does not guarantee permanent data retention; check progress in the installed context and keep private JSON backups.

Hosting still serves the checked-in files directly. For future shell edits, run `node tools/update-offline-cache.mjs` and commit its `sw.js` changes with the assets. `.gitattributes` keeps hashed text files LF so Windows checkout and hosted bytes match. This is release maintenance, not a build/install requirement. See [Offline PWA V1](./docs/OFFLINE_PWA_V1.md) for cache recovery and device-testing limitations.

## Focus timer

In **My Week**, choose 25, 5 or 15 minutes. Start, pause and resume; Reset returns to the selected duration. The timer catches up after backgrounding and survives refresh when saving works. Completion never awards XP. This app cannot reliably alert you while the browser is closed. Calendar reminders must be imported and depend on your calendar's settings.

## Keep your progress

In **My Goals**, focus on 1–3 active goals. Open a goal to **Park for later** or **Make active**; its progress stays with it. When you reach the real result, choose **I've achieved my goal**, explain what happened and how you know, and save it to your **Hall of Achievements**. Checking off tasks never marks the whole goal achieved. Older archived goals remain separately labelled until you choose their next step.

Open a companion card and choose **Name & style (optional)** to add a nickname, accent colour or accessory. Each goal keeps its own companion, even in the same family. **See my evolution path** explains XP and the four forms. Undoing an action keeps earned XP; repeating the same action earns no extra reward. Personal momentum counts days with an action or check-in in the past seven days, including rest check-ins, with no overdue penalties.

Use **Back up & restore** above any tab, or in **My Goals**. Choose **Download full backup** and keep the JSON file somewhere private. To restore, choose **Import Backup**, review the preview, then select **Replace my progress**. Cancel leaves your work unchanged.

Before replacing or migrating a save, the app keeps one recovery copy on this browser. Use **Review recovery copy** to restore it, or **More recovery options → Download recovery backup** to keep a separate file. Clearing browser data removes both local copies. If saving is blocked, full or unreadable, follow the visible warning and keep the page open while downloading your work. Original unreadable data can be downloaded under **More recovery options**.

New students start with an empty collection. **My Goals → Try sample goals** loads demo content only after confirmation and a successful recovery save. Existing student records never receive sample goals automatically.

## Browser regression checks

If Playwright and a compatible browser are already available, run `node --test tests/browser.mjs tests/data-safety.browser.mjs tests/goal-collection.browser.mjs tests/companion-gameplay.browser.mjs tests/accessibility-stability.browser.mjs tests/offline-pwa.browser.mjs`. The suites start loopback static servers under `/goal-quest/` (and `/` for offline tests) and use isolated synthetic student data. Retained V4 workflow/state comparisons normalize explicit Phase 3/4A/4B/5 additions. Phase 5 intentionally changes contrast, touch targets and wrapping; new responsive/semantic assertions and inspected screenshots replace exact screenshot equality. The V4 reference hash and all 28 default SVGs remain checked. Dedicated suites test backup safeguards, collection interfaces, real offline workers and update failures. No package installation is required by the app or the Node checks.

When Playwright is provided outside the repository, set `PLAYWRIGHT_MODULE_PATH` to its installed package directory. Set `BROWSER_CHANNEL=msedge` to use installed Edge, or leave it unset for Playwright Chromium. For example in PowerShell:

```powershell
$env:PLAYWRIGHT_MODULE_PATH = 'C:/path/to/existing/node_modules/playwright'
$env:BROWSER_CHANNEL = 'msedge'
node --test tests/browser.mjs tests/data-safety.browser.mjs tests/goal-collection.browser.mjs tests/companion-gameplay.browser.mjs tests/accessibility-stability.browser.mjs tests/offline-pwa.browser.mjs
```

The frozen integrity test expects LF line endings. `.gitattributes` preserves LF for `reference/capstone_quest_v4.html`, including Windows checkouts with `core.autocrlf=true`. Existing checkouts may need the one-time clean-fixture refresh documented in `docs/PHASE_1_2_VERIFICATION.md`. The reference content and expected hash remain unchanged.

Review the draft PR before merging or enabling GitHub Pages. Deployment is a separate approval step.

## Phase 7S-B1 preparation

The [B1 foundation report and Free test setup](./docs/PHASE_7S_B1_FOUNDATION.md) document disconnected Google/Supabase authentication helpers, proposed SQL and security tests. The running app remains local-only. No SDK runtime, cloud project, hosted migration or student cloud access is enabled. Database isolation and real OAuth still require tests in a separately approved environment; library and validation-policy decisions remain open for owner review.

## Scope and safety

- No framework, bundler, backend or AI APIs.
- External AI coach uses student-copied prompts only.
- No actual live sharing between students and mentors.
- Do not use a real student's information during early testing.
- Baseline functionality must work before any features are changed.
