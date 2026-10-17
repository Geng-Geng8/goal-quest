# Phase 1–2 verification

Branch: `refactor/modular-v4-parity` (from `main` at `2216977`).

## Scope and architecture

The original HTML shell and stylesheet were extracted without redesign. The app loads one native module entry point and a relative stylesheet. `app.js` alone creates the store, connects the feature modules and installs delegated document events. The features receive the store and rendering/navigation callbacks; imports are acyclic. Pure companion functions accept a goal or state explicitly. Date/ID helpers stay with state creation to avoid an extra utility module.

The seven modules are `app.js`, `state.js`, `companions.js`, `creator-smart.js`, `planner.js`, `academy-coach.js` and `ui.js`. The existing SMART+ slider's inline handler is now a delegated input handler with the same displayed value. V4 templates, copy, SVGs, calculations, serialized fields and `h4_goal_quest_v4` are preserved. There are no new runtime dependencies, build steps, APIs, backend, auth, PWA, sharing or gameplay features.

`reference/capstone_quest_v4.html` and `tests/baseline.test.mjs` remain unchanged. No merge, deployment or Pages configuration was performed.

## Phase 1

Before extraction, `index.html` and the frozen reference were byte-identical. Fresh V4 startup, all five tabs, saved navigation after refresh and horizontal overflow were checked in headless installed Edge at 375, 390 and 1365px. All browser checks passed without JavaScript exceptions.

The original Node run passed syntax and vocabulary checks, but the integrity assertion failed because this Windows checkout uses `core.autocrlf=true`. The working reference hash is `3775c6fe61816621dba49381b42966371c02e82f9658362d2094866d5b1665bc`; its LF representation matches the frozen expected SHA-256 `7607ba293945da65c00b18b67462c12f2f2bc68083b8a747946fdcba92b26d48`. Neither the reference nor the expected hash was edited. The complete Node suite was also run against an LF export of the staged files.

## Commands and results

- `node --test tests/modules.test.mjs`: 7 tests passed in the working checkout.
- `node --test tests/*.test.mjs`: 10 tests passed in an LF export. In the CRLF working checkout, 9 pass and the pre-existing reference hash assertion fails as described above.
- `node --check` for every `js/*.js`: passed.
- `git diff --check` / `git diff --cached --check`: passed.
- `node --test tests/browser.mjs`, using the already installed Playwright and Edge channel: 3 viewport tests passed. The suite supplies its own loopback static server and isolated synthetic records; no package install was added.

The LF check exports the index into a fresh temporary directory without touching the working reference:

```powershell
$verificationPath = (Join-Path $env:TEMP ('goal-quest-lf-' + [guid]::NewGuid().ToString('N'))).Replace('\','/') + '/'
git -c core.autocrlf=false checkout-index --all --prefix=$verificationPath
node --test ($verificationPath + 'tests/*.test.mjs')
```

Browser checks compare the frozen app with the refactored app at `/goal-quest/`, exercising GitHub Pages relative paths. Across the three widths there are 42 paired DOM/state checkpoints and 21 full-page visual comparisons. Screenshot comparison uses a YIQ perceptual color threshold of 0.05, with zero pixels allowed above that threshold, to account for observed Edge gradient/compositor rounding between browser contexts. DOM and persisted data comparisons are exact, except the inline slider-handler attribute is normalized to its delegated-event attribute. Phone and desktop screenshots were also visually inspected.

Covered flows:

- All five tabs, desktop sidebar/mobile bottom navigation, refresh and existing records containing unknown fields.
- Five-step creation, required-field and agreement validation, examples, custom/suggested task add/remove, scheduling, unscheduled actions, draft save/resume/restart and creation after refresh.
- Goal editing, completion/undo/recompletion, independent per-goal progress and four-stage evolution preview.
- SMART+ challenge display, duplicate primer rejection, commitment, WOOP, escaped journal/evidence text and daily check-in editing without duplicate XP.
- Seven-day plan, adding and rescheduling tasks, timer presets/start/pause/reset/completion/navigation and no timer XP.
- All six lessons, seven Wheel sliders and saved ratings, Escape/backdrop dismissal.
- All four external prompt previews/copies, accountability message, and manual clipboard fallback. Clipboard writes are captured in the isolated test page.
- Actual JSON and recurring 30-day `.ics` downloads; exact download payload parity; cancel/accept demo reset.
- No JavaScript or console errors, horizontal overflow, or third-party network requests during the tested flows.

Pure-function tests additionally compare XP caps and evolution thresholds, all 28 family/stage SVG variants, player level, momentum, local date shifts, escaping, state shape and preservation of empty non-demo records directly with V4. A blocked browser-storage getter also retains V4's startup fallback and save warning.

## Behavioral differences and remaining issues

No behavioral differences were found in the tested flows. The only intentional DOM mechanism change is replacing the existing inline slider handler with delegated input handling.

The CRLF integrity-test issue remains documented rather than changing the frozen files. Existing V4 limitations also remain: partial backup export with no restore, session-only timer state, initialization fallback for malformed storage, and the deferred accessibility/date/gameplay improvements described in the product brief. V4's Coach copy still includes legacy “Capstone” wording, retained for parity. These belong in separate phases.

Validation used desktop Edge with mobile viewport emulation. Physical mobile devices, Safari and Firefox were not tested. No student records or production environment were used.
