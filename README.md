# H4 Goal Quest

The V4 app is organized into native ES modules with no build step. Its appearance, interactions, copy, gameplay and saved data remain equivalent to the frozen standalone prototype. No app features or data integrations have been added.

## What's here

- `index.html` — original app shell, loading `./styles.css` and `./js/app.js`.
- `styles.css` — unchanged V4 stylesheet.
- `js/app.js` — the only composition root; navigation and delegated events.
- `js/state.js` — local saved state, demo defaults, date/ID helpers and existing partial export.
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

## Browser regression checks

If Playwright and a compatible browser are already available, run `node --test tests/browser.mjs`. The suite starts its own loopback static server and uses isolated synthetic student data. It compares DOM, saved state, downloads, copied text and screenshots with V4, including a `/goal-quest/` project URL. No package installation is required by the app or the Node checks.

When Playwright is provided outside the repository, set `PLAYWRIGHT_MODULE_PATH` to its installed package directory. Set `BROWSER_CHANNEL=msedge` to use installed Edge, or leave it unset for Playwright Chromium. For example in PowerShell:

```powershell
$env:PLAYWRIGHT_MODULE_PATH = 'C:/path/to/existing/node_modules/playwright'
$env:BROWSER_CHANNEL = 'msedge'
node --test tests/browser.mjs
```

The frozen integrity test expects LF line endings. `.gitattributes` preserves LF for `reference/capstone_quest_v4.html`, including Windows checkouts with `core.autocrlf=true`. Existing checkouts may need the one-time clean-fixture refresh documented in `docs/PHASE_1_2_VERIFICATION.md`. The reference content and expected hash remain unchanged.

Review the draft PR before merging or enabling GitHub Pages. Deployment is a separate approval step.

## Scope and safety

- No framework, bundler, backend or AI APIs.
- External AI coach uses student-copied prompts only.
- No actual live sharing between students and mentors.
- Do not use a real student's information during early testing.
- Baseline functionality must work before any features are changed.
