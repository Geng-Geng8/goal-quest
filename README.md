# H4 Goal Quest

H4 Goal Quest is a vanilla ES-module app with no build step. Phase 3 adds full private backups, validated restore, recovery copies and visible save warnings. The V4 gameplay, XP, companion evolution and core appearance are preserved.

## What's here

- `index.html` — original app shell, loading `./styles.css` and `./js/app.js`.
- `styles.css` — V4 stylesheet plus backup controls and storage warnings.
- `js/app.js` — the only composition root; navigation and delegated events.
- `js/state.js` — local saved state, atomic replacement, recovery copies, demo defaults and date/ID helpers.
- `js/data-safety.js` — complete backup format, strict validation and additive V4 → V5 migration.
- `js/data-controls.js` — backup/import/recovery dialogs and save warnings.
- `js/companions.js` — seven families, SVGs, XP, evolution, player level and momentum.
- `js/creator-smart.js` — goal collection/detail, five-step creator, draft and goal editing.
- `js/planner.js` — Today, My Week, tasks, check-in, session timer and calendar reminder.
- `js/academy-coach.js` — six lessons, Wheel, SMART+/WOOP activities and copyable prompts.
- `js/ui.js` — escaping, modal, toast, clipboard and download utilities.
- `reference/capstone_quest_v4.html` — **do not edit**; regression baseline.
- `docs/H4_Goal_Quest_V1_Complete_Product_Brief.md` — complete product vision; distinguishes working, planned and future features.
- `AGENTS.md` — constraints for Codex / Antigravity.
- `docs/PHASE_1_2_CODEX_PROMPT.md` — ready-to-paste implementation assignment.
- `tests/baseline.test.mjs` — no-dependency integrity/syntax check for the frozen baseline.
- `tests/modules.test.mjs` — no-dependency structural, data and pure-function parity checks against V4.
- `tests/browser.mjs` — optional full browser comparisons against V4 at 375, 390 and 1365px.
- `tests/data-safety.test.mjs` — backup, validation, migration, cancellation, recovery and storage-failure tests.
- `tests/data-safety.browser.mjs` — optional real-browser backup/restore tests, including an actual V4 download.
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

## Keep your progress

Use **Back up & restore** above any tab, or in **My Goals**. Choose **Download full backup** and keep the JSON file somewhere private. To restore, choose **Import Backup**, review the preview, then select **Replace my progress**. Cancel leaves your work unchanged.

Before replacing or migrating a save, the app keeps one recovery copy on this browser. Use **Review recovery copy** to restore it, or **More recovery options → Download recovery backup** to keep a separate file. Clearing browser data removes both local copies. If saving is blocked, full or unreadable, follow the visible warning and keep the page open while downloading your work. Original unreadable data can be downloaded under **More recovery options**.

New students start with an empty collection. **My Goals → Try sample goals** loads demo content only after confirmation and a successful recovery save. Existing student records never receive sample goals automatically.

## Browser regression checks

If Playwright and a compatible browser are already available, run `node --test tests/browser.mjs tests/data-safety.browser.mjs`. The suites start loopback static servers and use isolated synthetic student data. Gameplay DOM, state and screenshots still compare with V4, with only the explicit backup UI and schema version normalized. The new suite directly tests those data-safety changes. Both use a `/goal-quest/` project URL. No package installation is required by the app or the Node checks.

When Playwright is provided outside the repository, set `PLAYWRIGHT_MODULE_PATH` to its installed package directory. Set `BROWSER_CHANNEL=msedge` to use installed Edge, or leave it unset for Playwright Chromium. For example in PowerShell:

```powershell
$env:PLAYWRIGHT_MODULE_PATH = 'C:/path/to/existing/node_modules/playwright'
$env:BROWSER_CHANNEL = 'msedge'
node --test tests/browser.mjs tests/data-safety.browser.mjs
```

The frozen integrity test expects LF line endings. `.gitattributes` preserves LF for `reference/capstone_quest_v4.html`, including Windows checkouts with `core.autocrlf=true`. Existing checkouts may need the one-time clean-fixture refresh documented in `docs/PHASE_1_2_VERIFICATION.md`. The reference content and expected hash remain unchanged.

Review the draft PR before merging or enabling GitHub Pages. Deployment is a separate approval step.

## Scope and safety

- No framework, bundler, backend or AI APIs.
- External AI coach uses student-copied prompts only.
- No actual live sharing between students and mentors.
- Do not use a real student's information during early testing.
- Baseline functionality must work before any features are changed.
