# Phase 5 — Accessibility & Stability

Branch: `feature/accessibility-stability-v1`, from latest `origin/main` at `f7e2272` (Phase 4B). Review only: no merge, deployment, Pages configuration or Phase 6 work.

## Audit findings and changes

| Observed problem | Focused correction |
| --- | --- |
| Timer deadline was session-only; refresh lost progress, selection styling reset on navigation, completion left a misleading Pause button. | One small `focus-timer.js` controller uses a wall-clock deadline. Start, pause, resume, reset, duration selection and completion persist; display ticks perform no storage writes. Navigation, page visibility, focus and pageshow refresh elapsed time. One interval exists only while running. Reset returns to the selected duration. Completed sessions require Reset or another duration before starting. |
| Timer status was visual only; a refreshed expired timer could not report completion. | A named timer has a separate polite status; countdown ticks are not live announcements. Completion changes the persisted status once and posts one polite message. There are no XP rewards, audio, notification permissions, service workers or closed-browser alarm promises. |
| Date-only parsing could treat a local calendar day as UTC; action days could move when viewed in another timezone. | Date-only strings stay calendar dates. Existing midday/setDate arithmetic is retained for schedules and DST. New completion and first-reward local dates are recorded separately from unchanged ISO timestamps. Today uses the completion day; momentum uses the original reward day. Historical records without these optional fields retain their existing timestamp fallback. |
| An open planner could retain yesterday's view. | Local midnight schedules one UI refresh, recalculated using the next local midnight rather than adding 24 hours. Return from background/sleep also refreshes the calendar day. Open forms are not replaced at midnight. |
| Calendar `DTSTAMP` was local time without UTC; copy implied a daily alert. | UTC `DTSTAMP`, floating local `DTSTART`, `DURATION:PT10M`, CRLF lines and a valid zero-offset alarm trigger. The existing 30-day daily recurrence remains. Copy explains calendar import, local time and the calendar application's control of alerts. |
| Most older fields had visual labels without associations, including the creator, SMART+/WOOP and task/reflection forms. Copy previews had no names. | Explicit label/control associations and names for schedule selectors, preview textareas and timer reset. Category and task buttons expose pressed state. Planner days have meaningful names with dates and finished-action counts. |
| Older dialogs had no focus trap/return; three newer controllers duplicated the keyboard loop. Closed backup details could interfere with focus. | One shared dialog lifecycle names the dialog from its heading, isolates the background using native `inert`, locks background scrolling, sets initial focus, wraps Tab/Shift+Tab around visible enabled controls, and restores the opener or its replacement. Closed details are excluded from the focus loop. Escape, close, backdrop and existing Cancel paths retain cancellation semantics. |
| Navigation rerenders could lose keyboard focus; wizard validation only displayed a brief toast. | Navigation focuses the main heading; equivalent buttons retain focus after other rerenders. A skip link, desktop navigation landmark and current-page state are added. Wizard errors remain inline, announce through an alert, identify invalid fields and focus the first missing answer. Required text forms reject whitespace-only answers using native validation. |
| Some small text, saved status and focus outlines lacked sufficient contrast; several controls were 24–35px tall. | Darker muted text/status/focus colours within the existing palette, pressed-state semantics, a visible selected-category check and underlined current navigation. Small buttons, task controls and summaries have 44px targets. Existing reduced-motion rules remain and are tested. |
| Narrow forms, long labels and short landscape screens were difficult to use. | Targeted wrapping, single-column phone cards/hero, scrollable desktop sidebar, modal viewport limits, safe-area spacing, and 16px phone form controls. The five tabs, artwork and design system remain. |

## Data contract and preservation

The primary key remains **`h4_goal_quest_v4`**. Schema **8** accepts V4, V5, V6 and V7 full records and backup envelopes, plus the existing partial V4 exports and recovery formats. Migration changes the version and existing absent defaults only; no timer or per-task metadata is eagerly injected into old/full-limit records. Unknown compatible fields, original recovery bytes, validation limits and recovery-first replacement ordering remain protected.

On first timer interaction, `focus` gains validated `status` (`ready`, `running`, `paused`, `complete`), integer `remainingMs`, and a running epoch-millisecond `deadline` or `null`. `minutes` retains its existing accepted range; the UI still offers 25, 5 and 15 minutes. Complete snapshots are validated together. Extra compatible focus fields are preserved. A restore stops the prior interval and reads the restored timer, rather than resetting the imported state. An overdue restored timer reconciles when opened. Failure to save leaves a working in-memory timer with the existing persistent warning and backup path.

New task completions add optional validated `completedDate` and first-credit `rewardedDate` strings. No old timestamp, XP total, reward flag, goal state, note, reflection, companion identity or evolution form is rewritten by migration. Legacy first-credit timestamps remain authoritative when a local-day snapshot does not exist; the original recording timezone cannot be reconstructed from those UTC timestamps.

No backend, API, auth, analytics, cloud account, runtime package, build step or PWA infrastructure was added. The frozen V4 reference and canonical educational brief remain unchanged. Previous schema-7 app versions cannot read a schema-8 record: keep a pre-upgrade backup/recovery original for rollback and retain a current full backup for any new work.

## Verification

All records are synthetic. Tests use isolated profiles and loopback static hosting, including the `/goal-quest/` project path. No student information is transmitted.

- Node baseline before editing: **65 passed**. Final `node --test tests/*.test.mjs`: **77 passed, 0 failed**. All five browser suites together: **56 passed, 0 failed**, using installed Edge 155.0.4283.45. All application modules passed `node --check`; `git diff --check` passed. No console errors, unwanted horizontal page scrolling or external requests occurred in the asserted flows. Mobile Today, creator review, desktop Today and landscape screenshots were visually inspected.
- New Node coverage (12 added checks): timer pause/resume/reset, reload, delayed callbacks, one interval, no per-tick writes, completion once, schema validation, V4–V7 migration, backup/restore/recovery and blocked writes. Date probes run in separate processes in `America/Toronto`, `America/Los_Angeles`, `Pacific/Kiritimati`, `Asia/Kathmandu` and `UTC`, including midnight, leap day/year rollover, spring/fall DST, 23/25-hour days, timezone travel, check-ins, achievement and calendar formatting.
- New Edge coverage (15 added checks): all five tabs, core creator at 320/375/390/430/768/1365px and 844×390 landscape; keyboard-only complete creator; labels, unique IDs, focus loops/return, Escape, contrast samples, focus indicator, reduced motion, timer navigation/reload/sleep correction, real downloaded timer backup/import, quota failure, and foreground/background midnight rollover.
- Reflow equivalents use 683px/341px CSS viewports for approximately 200%/400% zoom on a 1365px desktop. This does **not** claim actual browser zoom testing or physical keyboard-overlay testing.
- Existing V4 workflows continue to compare 42 paired student-state/DOM checkpoints. Phase 5's explicitly changed timer, local-day metadata, labels, focus semantics, calendar fields and feedback are handled explicitly; unrelated data and DOM still compare. Exact V4 screenshot equality is intentionally replaced because contrast, touch targets and wrapping now differ. Screenshots accompany responsive assertions and visual inspection; frozen-reference integrity and all 28 original default SVG comparisons still run.

Commands (using the already supplied Playwright runtime; no install):

```powershell
node --test tests/*.test.mjs
$env:PLAYWRIGHT_MODULE_PATH = 'C:/path/to/existing/node_modules/playwright'
$env:BROWSER_CHANNEL = 'msedge'
node --test tests/browser.mjs tests/data-safety.browser.mjs tests/goal-collection.browser.mjs tests/companion-gameplay.browser.mjs tests/accessibility-stability.browser.mjs
git diff --check
```

Available engine: installed **Microsoft Edge / Chromium 155.0.4283.45**. Firefox and WebKit launch probes reported missing executables (`firefox-1538`, `webkit-2336`). No engines or packages were downloaded. These engines have **not passed**. When already available, run the new suite with `BROWSER_ENGINE=firefox` or `BROWSER_ENGINE=webkit`; its other coverage stays the same.

## Manual browser/device checklist

Use synthetic goals and a downloaded backup. Serve the branch over HTTP. For each platform, record OS/browser version, input method, date/timezone and pass/fail notes.

1. Visit all five tabs. Check portrait/landscape, long goal/task names and 200%/400% zoom/reflow: no horizontal page scrolling, hidden navigation, clipped buttons or unreadable fields.
2. Create a goal through all five steps. Leave required answers blank, then correct them. Confirm focus and field names, H4 SMART wording, native date/select controls and scheduled action dates. Reload a saved draft.
3. Add, complete, reopen and reschedule an action; record a daily check-in twice. Verify one daily entry and no repeated rewards. Open SMART+, WOOP and evidence forms. Required whitespace-only answers must not save.
4. Open every dialog using the keyboard or screen reader. Check its name, initial focus, Tab/Shift+Tab loop, background isolation, scrollability, Escape/close/Cancel and return to the opener. Open/close **More recovery options** and repeat. Read a validation error and save warning with the screen reader.
5. Customize two companions independently, cancel once, save once, view evolution, and record an achievement. Verify retained XP, states, notes and artwork. With reduced motion enabled, no automatic or requested celebration motion should play.
6. Test 25/5/15-minute timers, pause, resume, reset, navigation, refresh and background/screen lock. Return after the deadline: show complete once, never award XP. Closing the browser is not a reliable alarm. Do not expect alerts while it is closed.
7. Download a backup, import it, cancel, then confirm. Review recovery and restore it. Check timer/goal/companion data after reload. Test with storage blocked/full in an isolated profile and confirm truthful warnings.
8. Around midnight/DST, check Today, week dates, completion day and one daily reflection. Import the `.ics` into the intended calendar and verify local times/recurrence. Alert delivery depends on that calendar's settings. In a DST gap or repeated hour, local-time disambiguation follows the browser/calendar.

| Platform | Additional manual checks (not yet completed) |
| --- | --- |
| iPhone Safari | VoiceOver field names/headings/current page/status; native date/select picker; keyboard opening/closing and focus visibility; Files backup download/import; landscape and safe-area tab bar. |
| Android Chrome | TalkBack navigation/status; keyboard overlays and date/select controls; Downloads/file picker; screen lock and return; font scaling. |
| Desktop Edge/Chrome | NVDA plus keyboard-only creator/task/restore/achievement flows; actual browser 200%/400% zoom; blocked-storage profile; sleep/resume; downloaded files and calendar import. Edge automation does not substitute for these manual checks or a Chrome run. |
| Desktop Firefox | Full common checklist with keyboard and NVDA; native focus/inert/scrolling behaviour, date/select controls, downloads/import and sleep/resume. No automated Firefox pass is claimed. |

## Remaining limits

This is a practical WCAG 2.2 AA effort, **not** a conformance certification or a complete assistive-technology audit. VoiceOver, TalkBack, NVDA, actual Safari/Firefox, physical phones, actual desktop zoom and calendar-client interoperability remain manual/pilot work. Reflow and screen sizes are emulated in Edge. Contrast assertions sample representative text/control combinations, not every possible rendered pixel.

Wall-clock timers depend on the device clock; deliberately changing it can change the remaining time. Background/closed-browser alarms are not guaranteed. Completion reconciliation requires returning to the app; there is no hidden background service. Concurrent tabs retain the existing stale-save protection rather than live timer synchronization. The app cannot invent the original local day for historical UTC timestamps without a saved local-day field. Existing storage quotas and localStorage's cross-key/crash limitations remain as documented in Student Data Safety.

Stop at the draft PR for owner review and approval.


## Changed files

- `index.html`, `styles.css`: landmarks, skip link, contrast, focus, targets and responsive fixes.
- `js/focus-timer.js` (new), `js/planner.js`: persistent timer, status, local completion display, labelled planner forms and iCalendar formatting.
- `js/app.js`, `js/ui.js`: composition/lifecycle events, local midnight refresh, shared dialog focus, keyboard flow and validation.
- `js/state.js`, `js/data-safety.js`, `js/data-controls.js`: calendar-date parsing, validated additive schema 8, restored timer synchronization and deduplicated save announcements.
- `js/gameplay.js`, `js/companions.js`: local completion/first-credit days and retained momentum semantics, including legacy re-completion.
- `js/creator-smart.js`, `js/academy-coach.js`, `js/goal-collection.js`, `js/companion-controls.js`: explicit labels, creator errors, shared focus ownership and unique artwork instance IDs.
- `tests/accessibility-stability.test.mjs`, `tests/accessibility-stability.browser.mjs` (new): focused regressions and responsive/keyboard checks.
- `tests/browser.mjs`, `tests/modules.test.mjs`, `tests/companion-gameplay.test.mjs`: explicit Phase 5 contracts, schema version expectations and retained V4 comparisons.
- `README.md`, `docs/STUDENT_DATA_SAFETY.md`, `docs/GOAL_COLLECTION_V1.md`, `docs/COMPANION_GAMEPLAY_V1.md`, this report: current usage/compatibility and verification handoff.
