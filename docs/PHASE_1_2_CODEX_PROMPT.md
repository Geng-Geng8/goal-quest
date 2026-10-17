# Ready-to-paste Codex / Antigravity prompt — Phase 1–2 only

You are the lead web developer for **H4 Goal Quest**, a mobile-first goal-achievement game and educational app for students aged 13–18.

**Read these files before touching code:**
1. `AGENTS.md` — binding instructions and acceptance criteria.
2. `docs/H4_Goal_Quest_V1_Complete_Product_Brief.md` — product vocabulary and V1 scope.
3. `reference/capstone_quest_v4.html` — frozen baseline that MUST NOT be edited.
4. `index.html` — currently an exact working copy of the V4 standalone app.
5. `tests/baseline.test.mjs` — frozen-baseline integrity test.

## Assignment

Complete **Phase 1 baseline verification and Phase 2 behavior-preserving extraction into native ES modules**. Do not expand scope into feature upgrades, backup import, PWA, UX redesign, backend, AI integration or deployment.

1. Inspect repository status, main branch, and current files. Confirm that the existing `index.html` works and matches the frozen baseline; run existing checks. If there are unstaged user changes, do not overwrite them.
2. Create feature branch `refactor/modular-v4-parity` from latest safe main, unless it already exists and is appropriate to continue.
3. Move embedded CSS unchanged to `styles.css` and load it from `index.html`.
4. Extract the inline JavaScript into native ES modules under `js/`:
   - `app.js`: initial boot, navigation, event delegation and orchestration.
   - `state.js`: `h4_goal_quest_v4` local persistence, initial/demo data and existing export behavior.
   - `companions.js`: seven SVG creature families, four stages, XP, overall level, Momentum.
   - `creator-smart.js`: five-step goal wizard, autosaved draft, SMART+, WOOP, goal editing.
   - `planner.js`: Today, seven-day planning, check-ins, task completion/rescheduling, Pomodoro, calendar export.
   - `academy-coach.js`: six lessons, Wheel of Life, partner check-in copy, external AI coaching prompts.
   - `ui.js`: shared safe DOM/modal/toast utilities only if useful.
5. Make `index.html` the semantic app shell and load one entry point: `<script type="module" src="./js/app.js"></script>`. Use only relative file URLs and do not rely on global inline handler functions.
6. Preserve identical V4 behavior, strings, data shape, localStorage key, navigation, styling, SVG artwork and interactions. Separate modules along clear responsibility boundaries and avoid circular imports.
7. Add automated tests for core pure functions and browser-level smoke tests if the environment supports a browser automation runner already installed. No new runtime packages; if extra test dependencies are truly needed, ask first. The frozen reference file and integrity test must remain unchanged.
8. Run syntax checks and actual browser tests at mobile and desktop widths via a local static server. Verify saved user data still loads after refresh; verify completion/undo does not double-count XP and that creating and scheduling a new goal works.
9. Commit your work to the feature branch and open a **draft PR**, if GitHub permissions are available. Otherwise provide exact commits, branch and commands needed to create the PR.
10. Report changed files, test commands and results, any known issues, and behavioral differences. **Do not merge, deploy, turn on Pages or undertake the next phases without explicit approval.**

## Manual smoke-test checklist

- All five tabs: Today / My Week / My Goals / Learn / Coach.
- Open wizard, create a goal, define outcome/date, create first task, schedule the task, finish wizard, refresh, and confirm data persists.
- Complete and undo a task; confirm exactly the expected per-goal XP/evolution behavior.
- Open a goal; edit it; save SMART+ activities and WOOP plan; add a journal/evidence entry.
- Wheel of Life sliders work and retain saved ratings.
- My Week shows seven days; reschedule; test Pomodoro start/pause/reset; generate an `.ics` file.
- Copy an external AI coach prompt and an accountability message (no LLM API calls).
- Check export functionality and demo reset; record existing behavior faithfully rather than silently implementing future restore.
- No console exceptions or horizontal overflow on a 375px phone viewport and 1365px desktop.

**Stopping rule:** If extraction requires behavior changes or migration to new persisted state, STOP and explain the conflict. The refactoring PR must be reviewable as an extraction-only change.
