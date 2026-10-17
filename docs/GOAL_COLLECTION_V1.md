# Phase 4A — Goal Collection & Achievement System

Branch: `feature/goal-collection-v1`, from latest `origin/main` at `6220605` (Phase 3 merged).

## Student experience

- **My Goals** keeps active goals, parked goals, and the **Hall of Achievements** together. The five navigation tabs are unchanged.
- Open an active goal and choose **Park for later**. Tasks, schedules, XP, companion progress, SMART+/WOOP, milestones, check-ins and journal entries stay with that goal. **Make active** brings it back whenever the student chooses.
- New goals and reactivations encourage at most three active goals. At capacity, a single choice offers **Keep this goal parked**, or parking selected active goals to make room. Cancel/Escape/backdrop/close changes nothing; a new goal draft remains saved. A migrated collection with more than three active goals stays intact; the student chooses what to park. Adding another active goal requires enough parking choices to leave three.
- Today and My Week show only active-goal tasks, counts and day indicators. The new-action selector lists active goals. Today uses an active companion, evolution path, accountability message and goal check-in even after a parked or achieved goal was viewed. Parked goals remain available in My Goals, including their read-only action history. Parked and previously archived goals must be made active before completing, undoing or rescheduling actions; journal notes remain available on all inactive goals.
- **I've achieved my goal** asks what the student accomplished and how they know, using the saved success statement as a reminder. Evidence references and a milestone note are optional. These are private text notes, not uploads or external verification.
- Checking every action never achieves a goal automatically. An explicit achievement may include unfinished actions; completing an action plan and reaching a real-world result are separate events.
- Achieved goals show their companion, title, achievement date (including year), reflection, supporting explanation, and optional notes. Their original task history is read-only; new journal notes may still be added. The saved SMART+/WOOP plan and XP inputs stay intact.
- Celebration is a calm companion panel with an optional **Celebrate** button. The finite animation runs only after a click and is disabled for reduced motion. New collection dialogs have named headings, explicit labels, keyboard focus trapping/return and usable touch targets.

## Additive schema and compatibility

The primary key is still `h4_goal_quest_v4`. The state schema is now **6**, while the backup envelope remains **version 1**. Full V4 and V5 records, V4 partial exports, recovery copies and current backups all use the same validated import path. No fields are projected away and no sample goals are inserted during migration.

New optional goal fields:

```json
{
  "goalStatus": "achieved",
  "goalAchievement": {
    "achievedAt": "2026-10-17T16:00:00.000Z",
    "date": "2026-10-17",
    "reflection": "I performed my routine.",
    "howKnow": "My recording lasts 60 seconds.",
    "evidence": "My private practice video",
    "milestone": "Performed for a friend"
  }
}
```

`goalStatus` accepts `active`, `parked`, `achieved`, or `archived`. An achieved status requires a valid achievement record with a timestamp, local calendar date and nonblank reflection/explanation. Incompatible records are rejected before preview or writes. Unknown compatible fields remain preserved, including fields inside achievement records.

Migration changes only the schema version for complete old records. When `goalStatus` is absent, `archived:false` (or an absent archived flag) retains the existing active meaning. **`archived:true` becomes neither parked nor achieved:** it stays under a clearly labelled **Previously archived** section until the student explicitly chooses Make active, Keep parked, or records a real achievement. No completion date or reflection is invented. After an explicit choice, `goalStatus` takes precedence and the original `archived` field is retained unchanged. Existing records with more than three active goals are not silently capped.

Keeping lifecycle fields optional avoids adding per-goal overhead during migration, so existing full-limit saves still fit the 2 MiB backup boundary. Migration is pure and idempotent. Before the first V4/V5 migrated write, the existing Phase 3 store preserves the exact original raw disk text in recovery. Validated/exportable saves, recovery-first restore, stale-preview/cross-tab guards, recovery rollback, storage warnings, damaged-original download and explicit demo reset remain in `state.js` and `data-controls.js`, unchanged.

Achievement is idempotent: a second submission cannot replace an existing achievement. **No completion XP bonus is added**; the Hall entry and celebration are the reward. Existing XP, stage, player level and momentum calculations in `companions.js` are unchanged. Parking, activation and achievement do not modify their XP inputs.

Older application versions reject schema 6 rather than understand these states. For a code rollback, retain a current full backup and use a pre-migration V4/V5 original/recovery record with the old app; do not manually downgrade the version number. The single recovery slot can later be replaced by another restore/reset, as documented in Phase 3.

## Changed files

- `js/goal-status.js` (new): pure lifecycle rules, active selection, atomic parking choices and idempotent achievement.
- `js/goal-collection.js` (new): activation choices, achievement forms/celebration, keyboard focus and save-status feedback.
- `js/creator-smart.js`: collection sections, goal controls, retained achievement history and creator capacity handling.
- `js/planner.js`: active-goal planning, empty states and read-only achieved task history.
- `js/app.js`: composition/events, lifecycle guards and active daily context.
- `js/academy-coach.js`: Today accountability uses the active daily goal; achieved plans remain read-only.
- `js/data-safety.js`: schema 6, V4/V5 acceptance and lifecycle/achievement validation.
- `styles.css`: collection, achievement and accessible choice styling, with readable single-column mobile Hall cards.
- `tests/goal-collection.test.mjs`, `tests/goal-collection.browser.mjs` (new): lifecycle, migration, recovery and responsive interaction regressions.
- `tests/modules.test.mjs`: include the new modules in relative/acyclic architecture checks.
- `tests/data-safety.test.mjs`: unsupported future-version cases track the current version.
- `tests/browser.mjs`: retain V4 comparisons while explicitly normalizing the intentional collection/detail changes and additive metadata.
- `README.md`, `docs/STUDENT_DATA_SAFETY.md`, this report: current behavior, compatibility and verification.

## Verification

All data was synthetic, with isolated Edge profiles and localhost static hosting under `/goal-quest/`. No real student data or production storage was used.

- `node --test tests/*.test.mjs`: **46 passed**. Includes 10 new collection tests and all 36 prior unit/integrity tests: V4/V5 migration, exact legacy field retention, archived interpretation, idempotence, fourth-goal atomicity, legacy collections above three, active daily selection, independent task/goal completion, duplicate protection, mixed-state full backups/restores/recovery, storage failures, full 2 MiB boundaries, unknown fields and unchanged XP/evolution.
- `node --test tests/browser.mjs tests/data-safety.browser.mjs tests/goal-collection.browser.mjs`: **26 passed** (3 retained V4 workflow comparisons, all 16 Phase 3 browser tests, 7 new collection tests). Tests use existing Playwright with `PLAYWRIGHT_MODULE_PATH` and `BROWSER_CHANNEL=msedge`; no package installation or app dependency. No console errors, horizontal overflow or external requests in the checked flows.
- `node --check` for every application module and `git diff --check`: passed.
- The frozen V4 file and its expected hash are unchanged. Neither `state.js` nor `data-controls.js` nor `companions.js` was changed.
- Representative phone/desktop collection, Hall, achievement form, detail and focus-choice screenshots were visually inspected. Browser checks cover 375, 390 and 1365px, overflow, five-tab navigation, local-only requests, escaped student text, focus return/trapping and reduced motion.

The retained V4 browser suite still exercises the full original workflows with 42 paired state/DOM checkpoints and 15 unchanged-screen visual comparisons. For the intentionally replaced collection sections, existing active goal cards compare exactly. Detail comparisons remove only the added lifecycle panel and normalize the task-count label/focus attribute. Full current backups are asserted before additive lifecycle metadata is normalized for legacy parity. New collection surfaces are directly tested in the dedicated suite; the frozen reference is never altered.

## Known limits and review boundary

- Real iOS/Safari, Android hardware and Firefox remain unverified; tested phone sizes are emulated in installed Edge.
- Achievement is a student's self-report, not independent verification or certification. Evidence remains a text reference. There is no reopen/edit-achievement flow in this phase; an earlier backup can be restored through the existing preview/confirmation flow.
- Existing momentum calculations still include all saved goal tasks, including overdue parked/achieved tasks. Their redesign, anti-farming gameplay and broader timer/date/accessibility work remain outside Phase 4A.
- Local browser storage and the one recovery slot retain the Phase 3 quota, eviction and multi-tab limitations. Downloaded private backups remain important.
- No merge, deployment, GitHub Pages enablement, PWA work or Phase 4B changes. Stop at the draft PR for owner review.

## PR #3 review correction — inactive task history

Addressed the [latest review comment](https://github.com/Geng-Geng8/goal-quest/pull/3#issuecomment-6240584077). The new Node regression failed before the fix because a parked task still rendered completion and rescheduling controls.

The focused correction changes `js/planner.js`, `js/creator-smart.js` and `js/app.js`: task history is read-only unless `isActive(goal)` is true, and the completion/undo handler, reschedule-dialog opener and reschedule submission all enforce that rule independently. There is no change to stored records, migration, backup/recovery, XP calculations, companions or existing reflections. Parked/legacy archived goals regain task controls after activation; achieved goals retain the existing final/read-only behavior. Journal/evidence notes stay available in every state.

`tests/goal-collection.test.mjs` adds inactive history/dialog and reactivation coverage. `tests/goal-collection.browser.mjs` adds coverage at 375, 390 and 1365px: visible finished/unfinished history; stale complete/undo/reschedule controls and submitted forms leave the entire saved record unchanged; journal notes preserve prior content and XP/evolution; activation restores completion, undo and rescheduling; re-parking and refresh keep tasks read-only. The existing active-goal workflows and full backup suites remain unchanged.

Review-fix verification: `node --test tests/*.test.mjs` — **47 passed**; `node --test tests/browser.mjs tests/data-safety.browser.mjs tests/goal-collection.browser.mjs` — **29 passed** in installed Edge at all three widths. All application modules passed `node --check`, and `git diff --check` passed. Browser assertions found no console errors, horizontal overflow or external requests. The frozen V4 reference, schema, storage/recovery modules and companion calculations remain unchanged by this correction. Physical mobile devices/Safari/Firefox remain unverified. Stop for final review on the existing draft PR.
