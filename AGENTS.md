# AGENTS.md — H4 Goal Quest

## Mission
Build a fast, accessible, mobile-first, genuinely fun self-guided goal-achievement app for students aged roughly 13–18. The app teaches the **H4 Goal Meeting method** and helps students act on their goals daily. Human mentorship is encouraged but **not required**. Student data remains private by default.

**Canonical specification:** `docs/H4_Goal_Quest_V1_Complete_Product_Brief.md`.
**Immutable functional baseline:** `reference/capstone_quest_v4.html`.
**Current running app:** `index.html` (an exact copy of V4 until refactoring begins).

The product brief describes both working prototype features and future intentions. **Do not treat a planned feature as already implemented.** If instructions conflict with observable V4 behavior, preserve V4 during the parity refactor and flag the discrepancy.

## Product language (do not silently change)
- Name: **H4 Goal Quest** (working name); educational method: **H4 Goal Meeting**.
- SMART: **Specific, Measurable, Agreed Upon, Realistic, Timely**. In particular, **A = Agreed Upon**, not Achievable.
- SMART+: **Challenging, Primers, Accountability, Commitment**; optional but encouraged.
- WOOP, H4 teaching version: **Wish, Opportunity, Obstacle, Plan**; the Plan includes **if–then** statements.
- Seven student life areas: School & Future; Money & Independence; Health & Fitness; Learning & Growth; Family & Relationships; Friends & Community; Purpose & Values.
- Seven companion families: **Astri, Coino, Embi, Glimo, Hugo, Sprig, Luma**, each with four visual evolution stages. Each *goal instance* earns its own XP and progresses independently, even if multiple goals use the same family.
- Five primary tabs: **Today**, **My Week**, **My Goals**, **Learn**, **Coach**; also a five-step goal creator.
- Coach is a collection of **copy-and-paste prompts for an external LLM**, not a chatbot embedded in the app.

## Non-negotiable engineering constraints
1. **Zero-build web app:** semantic HTML, vanilla CSS, native ES modules and browser APIs only. No React, TypeScript, bundler, framework, remote CDN, analytics SDK, or runtime dependencies unless the owner expressly approves.
2. **No AI API, backend, auth, cloud storage or third-party data transmission** in V1. Copy prompts locally; students decide if/when to paste them into another tool.
3. **Static hosting compatible:** GitHub Pages project URL, using relative paths (`./...`, not site-root `/...`). Work via a localhost static server. Offline PWA comes in a **separate** future phase.
4. **Student data first:** do not change the browser storage key `h4_goal_quest_v4`, silently reset data, discard fields, or seed demo goals into an existing real record. Avoid breaking persisted structures. Full validation, schema migrations and backup/restore come in the separate data-safety phase.
5. **No default public sharing:** personal goals, Wheel of Life ratings and reflections are private. Live mentor accounts or shareable student records are **not** part of the baseline.
6. **Avoid addictive/punitive mechanics:** XP represents meaningful progress, not app-opening or taps; keep rest and rescheduling non-shaming. Do not introduce public leaderboards, fake motivational statistics or unverified completion claims.
7. **Keep it responsive and accessible:** mobile bottom navigation; desktop sidebar; keyboard and screen-reader support, meaningful focus styles, usable contrast, reduced-motion support, readable teen-friendly language.
8. **Simplicity over cleverness:** small focused functions, clear state ownership, no unneeded infrastructure, safe DOM updates, no circular imports. Do not overengineer.
9. **Never merge or deploy without explicit approval.** Use a feature branch, report what changed and what was tested, and stop after requesting review.

## Implementation stages — scope control

### Phase 1: Frozen baseline (starter package)
- Keep `reference/capstone_quest_v4.html` unchanged forever; it is the regression oracle.
- `index.html` is initially the same self-contained file, so it runs before any refactor.
- Keep this `AGENTS.md`, `README.md`, and product brief in the repo.
- Verify basic startup, mobile layout, all five tabs, and local persistence without modifying functionality.

### Phase 2: Extraction-only modular refactor
- Extract existing inline styles to `styles.css`.
- Extract script into these focused ES modules (adjust only if you can explain an objectively simpler architecture):
  - `js/app.js`: startup, delegated events, navigation, orchestration; the **only composition root**.
  - `js/state.js`: saved-state access, initial/demo data, persistence, existing export behavior.
  - `js/companions.js`: creature SVGs, XP and evolution, player level, momentum.
  - `js/creator-smart.js`: five-step goal creator, SMART+, WOOP and goal editing.
  - `js/planner.js`: Today, My Week, tasks, check-in, timer, .ics export.
  - `js/academy-coach.js`: Wheel of Life, learning chapters, accountability and external prompt templates.
  - `js/ui.js`: shared dialog/toast/rendering utilities, if needed.
- Prefer data/pure functions in feature modules with state and callbacks provided by `app.js`; avoid circular cross-imports.
- `index.html` loads only `./js/app.js` as `<script type="module">`, and loads `./styles.css`.
- **Do not add or remove UX features, alter copy, tune XP or ratings, add PWA support, rewrite the markup, change state fields, or introduce additional dependencies during Phase 2.** If a baseline bug blocks parity, document it for a separate fix.
- Keep all functionality equivalent to V4 and verify the full regression checklist below.

### Later phases — do NOT bundle into the refactor PR
1. **Data safety:** complete JSON export + validated import, recoverable backup, data migrations, storage failure handling, onboarding/demo separation.
2. **Gameplay:** active/parked/completed goals; truthful goal-achieved flow; anti-farming XP; per-goal companion identity; compassionate momentum.
3. **Quality:** persistent timer, date/timezone hardening, keyboard/dialog accessibility.
4. **Offline PWA:** manifest, service worker, cache update and offline regression tests.
5. **Pilot and deployment:** responsive devices, install testing, release approval and GitHub Pages publish.

## Definition of done for the Phase 2 PR
- All five tabs render, navigate and keep working on mobile and desktop.
- Goal creation, autosaved drafts, scheduled first moves, SMART+/WOOP, Wheel ratings, check-ins, task completion and reversal, XP/evolution, evidence/reflections, companion collection, timer, .ics, external coaching prompt copy, export and demo reset behave as V4 does.
- Same persisted student state loads after refactor using **`h4_goal_quest_v4`**; no silent changes to serialized fields. Storage and navigation survive a refresh.
- No JavaScript errors in browser console; no layout overflow at 375–390px mobile and typical desktop width.
- Baseline fixture unchanged; tests run with Node's built-in test runner where possible, plus browser automation or a documented manual check of all important flows.
- No added backend, AI APIs, app framework, bundler, package install step or build command.
- Final report contains: changed-file list, commands/results, behavioral differences (should be none), unresolved issues, branch name and PR link. **Stop before merge/deploy.**

## Developer workflow
- Work in short, reviewable PRs from current `main` after checking `git status`, branch, and upstream changes.
- Serve locally: `python -m http.server 8000` (or `py -m http.server 8000` on Windows), visit `http://localhost:8000/`. Native ES modules cannot be reliably tested by double-clicking `index.html` via `file://`.
- Run `node --test tests/*.test.mjs` for no-dependency baseline tests. Add meaningful feature tests during Phase 2.
- Do not overwrite unrelated user changes, delete the baseline or rewrite tests to conceal failures.

## Privacy and youth-safety expectations
- A student can use the app without sending personal information to the developer.
- External coaching prompts should avoid auto-including sensitive personal information and should remind students to follow the external LLM provider's age/account and school rules.
- Accountability messages are copied by the student; nothing is secretly shared.
- Do not claim SHSM official certification, AI verification of progress, or a mental-health service.
