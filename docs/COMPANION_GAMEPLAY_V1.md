# Phase 4B — Companion Identity, Evolution & Healthy Rewards

**Phase 5 update:** Current schema 8 accepts V4–V7 backups and adds lazy validated timer/local-day metadata. Existing recovery ordering, goals, XP and companions are preserved. See [Accessibility & Stability V1](./ACCESSIBILITY_STABILITY_V1.md) for current behavior, verification and browser/device limits. The earlier-phase details below are historical.

Branch: `feature/companion-gameplay-v1`, from latest `origin/main` at `e91478a` (Phase 4A merged).

## Student experience

- Every goal keeps its own Astri, Coino, Embi, Glimo, Hugo, Sprig or Luma. The original seven palettes, shapes and four forms are preserved. All 28 default SVG combinations still match frozen V4 exactly.
- **Name & style (optional)** offers a nickname (up to 32 characters), three accent choices (family colour, mint, sunset), and three accessory choices (just me, scarf, star badge). A local preview changes before saving; Cancel/Escape/backdrop/close makes no data change. Original body colours remain recognizable; accents colour the accessory and a small base ring.
- Today, collection cards, goal detail, evolution previews and the Hall use the same per-goal name and artwork. Parking, reactivation and achievement keep them intact. Optional styling remains available on inactive/achieved companions without awarding XP.
- Cards show **Stage 1–4**, earned XP, and the exact XP needed for the next form. Thresholds remain **0, 145, 290, 435 XP**. The progress bar measures progress within the current stage; it restarts at each threshold. Guardian is the final form.
- A newly earned stage opens a calm, dismissible evolution panel. **Celebrate (optional)** runs a single 600 ms animation only after a click; reduced motion disables it. Reopening/re-completing an already rewarded action does not trigger another unlock. Normal navigation, styling, previewing, lessons and timer use earn no XP.
- New companion dialogs have named headings, labelled fields, keyboard focus trapping/return and buttons at least 44 px tall. Reduced motion also disables smooth scrolling and button movement on hover/press. This fixes a reproducible hover oscillation exposed by the taller detail layout.

## XP review and trade-offs

V4–V6 calculate XP from the current record: `min(done tasks,300)*35 + min(check-ins,100)*10 + (WOOP plan ? 25 : 0) + (commitment ? 20 : 0)`. Undoing tasks or removing plans previously removed their XP. The new rules retain those reward amounts and the stage/player-level thresholds:

| Activity | Credit | Repeat behavior |
| --- | --- | --- |
| Complete a real action | 35 XP for its goal | Once per task identity; undo keeps XP, re-completion earns zero |
| Daily check-in, including rest/stuck | 10 XP for that day's active companion | Once per student/calendar date; editing or switching goals earns zero |
| Save all four nonblank WOOP answers | 25 XP for its goal | Once; later edits, clearing and re-entry earn zero |
| Affirm SMART+ commitment | 20 XP for its goal | Once; unchecking/rechecking earns zero |
| Park/reactivate/achieve, customize, navigate, timer | 0 XP | The saved achievement/identity is its own reward |

**Planning while a goal waits:** SMART+ commitment and WOOP bonuses apply to any unfinished goal, including parked and previously archived goals. Editing a plan does not activate it or bypass the 1–3 active-goal focus choice. Tasks and daily check-in rewards still require an active goal; achieved plans stay final.

**Legacy preservation:** Migration changes the schema version without adding fields to every goal/task. Until a goal's first reward-relevant edit, its existing capped formula remains the fallback. That first edit captures its exact prior total and previously rewarded plan flags. An already finished legacy task is implicitly rewarded. When reopened, its original completion timestamp becomes its reward marker. Even legacy tasks/check-ins above the old caps cannot be re-awarded by cycling. Future distinct real actions and future daily check-ins can earn beyond those historical caps. There are no daily task quotas or punitive streaks; only JavaScript's safe integer ceiling bounds an imported extreme total.

**Intentional trade-off:** XP is earned permanently, so undo can correct the task list without shrinking a companion or clawing back prior stages. Undo removes that task from the recent completed-action summary while retaining its XP and first reward date. Repeated practice should be recorded as a separate real action. The local app cannot distinguish invented actions, duplicated task creation, clock changes, edited JSON or replaying an older backup from honest self-reports. It makes no verification claims and does not add arbitrary productivity limits. Rest/stuck check-ins are meaningful reflections and receive the same small daily credit.

The check-in is one daily student reflection, assigned to the active goal displayed when its form opens. A journal date that already exists in an old save is treated as already used; it cannot be moved between goals to create more XP. Existing duplicate legacy check-ins and their earned totals are preserved, not deduplicated retroactively.

## Personal momentum

The old 600–1100 rating is replaced with a transparent seven-day activity summary: unique local calendar days with a completed action or journal check-in, plus the number of actions and unique check-in dates. Several actions on one day add one activity day. Days need not be consecutive. Overdue dates are never read by this calculation, so active, parked, achieved and legacy archived work creates no penalties. Recent completed steps still count after a goal changes state. Re-completing an old task uses its first reward date, so it cannot refresh old work into this week.

The wording explains rest, illness and rescheduling, and calls this a personal activity summary rather than a measure of ability or wellbeing. There are no public comparisons, streak losses or psychological claims. The seven segments summarize a count of days, not a chronological calendar.

## Additive schema 7 and data safety

Primary key: **`h4_goal_quest_v4`**. Backup envelope: **version 1**. Full V4/V5/V6 saves, partial V4 exports and existing recovery formats continue through the same validated importer. Unknown compatible fields are retained, including within companion/reward objects. Optional new fields:

```json
{
  "companion": { "nickname": "Nova", "accent": "mint", "accessory": "scarf" },
  "rewards": { "xp": 80, "woop": true, "commitment": true },
  "tasks": [{ "rewardedAt": "2026-10-17T16:00:00.000Z" }]
}
```

This is an abbreviated goal example. Tasks retain all original fields. A new daily journal entry may also contain `goalId`, documenting which goal received its credit. The single XP total, two plan flags and one first-reward timestamp per touched task avoid a growing event ledger. A previously present nickname string is preserved by migration; the 32-character limit applies to new UI edits.

Identity and reward fields are validated when present. No per-goal defaults are added on migration, so a valid complete schema 6 save at exactly **2 MiB** remains the same size after its one-digit version changes. New schema 7 records with identity/rewards also round-trip at the exact byte limit, using the existing compact full-state fallback when the envelope would exceed it. All existing byte/structure limits remain unchanged. Editing an already full record can still exceed those limits, as before; it is not silently trimmed or written, and the save warning remains visible.

`state.js` and `data-controls.js` are unchanged. Recovery-first atomic replacement, original-text preservation before migrated writes, validation before preview/writes, stale-preview/cross-tab guards, recovery rollback, damaged-data download, explicit demo reset and truthful storage-failure messages remain owned by those modules. Unsaved companion/reward edits remain in memory and downloadable whenever they fit the existing limits.

Older app versions reject schema 7. Keep a full current backup and, if rolling code back, use an appropriate pre-migration original/recovery copy; do not manually change the version number. Local storage and the single recovery slot retain the documented Phase 3 quota/eviction/cross-tab limitations.

## Changed files

- `js/gameplay.js` (new): pure award-once rules and legacy XP fallback.
- `js/companion-controls.js` (new): customization preview, accessible evolution dialogs and optional celebration.
- `js/companions.js`: reusable identity/artwork, accurate stage progress, evolution presentation and momentum summary.
- `js/app.js`: reward orchestration, goal-bound daily check-ins, save-aware feedback and unlock handling.
- `js/creator-smart.js`, `js/planner.js`: collection captions and check-in goal context.
- `js/data-safety.js`: schema 7 acceptance and optional field validation.
- `styles.css`: scoped companion/evolution/summary styling and reduced-motion fixes.
- `tests/companion-gameplay.test.mjs`, `tests/companion-gameplay.browser.mjs` (new): identity, rewards, migration, lifecycle, limits, backup/recovery, quota failure, responsive layouts, keyboard and motion checks.
- `tests/modules.test.mjs`, `tests/browser.mjs`, `tests/goal-collection.browser.mjs`: retain prior workflows/artwork/storage coverage, with explicit assertions/normalization for the intentionally changed Phase 4B contract.
- `README.md`, `docs/STUDENT_DATA_SAFETY.md`, `docs/GOAL_COLLECTION_V1.md`, this report: current behavior and compatibility.

## Verification

All test records are synthetic, hosted on localhost under `/goal-quest/` with isolated Edge profiles. No new dependency or installation step is required by the app.

- `node --test tests/*.test.mjs`: **60 passed**, including all prior 47 checks and 13 new gameplay checks. Frozen V4 hash and all 28 default SVG comparisons pass. Legacy reward/stage preservation, plan/task cycling, daily goal switching, migration originals, backup/restore/recovery/reload, nested unknown fields, exact 2 MiB old/new records and the numerical bound are covered.
- `node --test tests/browser.mjs tests/data-safety.browser.mjs tests/goal-collection.browser.mjs tests/companion-gameplay.browser.mjs`: **37 passed** (all 29 prior browser tests plus 8 new companion tests). Installed Edge at 375, 390 and 1365 px; existing Playwright via `PLAYWRIGHT_MODULE_PATH`, `BROWSER_CHANNEL=msedge`, no package install. Browser launches require running outside the Windows sandbox.
- Retained V4 suite: **42 paired DOM/state checkpoints**, **12 unchanged-screen visual comparisons**. Original task/creator/SMART+/WOOP/evidence/planner/timer/calendar/lesson/prompt/export/reset workflows remain exercised. Only changed companion/momentum surfaces and additive reward metadata are normalized; new surfaces have direct dedicated checks. Undo now explicitly asserts retained XP, and evolution previews assert unique stage gradient IDs.
- New browser coverage: independent names/styles with live preview and cancellation, consistent Today/detail/Hall/evolution artwork, lifecycle retention, actual download/import/recovery/reload, one-time task/plan rewards, daily goal switching, unsaved identity/XP backup on quota failure, focus trap/return (including automatic unlock dismissal), normal/reduced-motion celebrations, and five tabs. Checked flows have no console errors, horizontal overflow or external requests.
- All app modules passed `node --check`; `git diff --check` passed. The frozen reference, canonical brief, `state.js` and `data-controls.js` have no diff.
- Representative mobile/desktop Today, customization, evolution, unlock and Hall screenshots were visually inspected. Source review and testing used only synthetic data; no merge/deployment or production writes were performed.

## Known limits and review boundary

- Tested phone widths are emulated in Edge. Physical iOS/Android, Safari and Firefox remain unverified; this is not a complete accessibility audit or evidence of student retention.
- New XP is self-reported and local. The permanent credit and historical-cap choices above are deliberate; no outcome verification or anti-tampering service is implied.
- No currencies, shops, purchases, backend, AI/API integration, PWA, goal-creator redesign or navigation changes were added. The frozen V4 reference and canonical product brief are untouched.
- Stop at the draft PR for owner review. Do not merge, deploy, enable Pages or begin Phase 5.


## PR #4 review correction — planning rewards on waiting goals

Addressed the [latest review comment](https://github.com/Geng-Geng8/goal-quest/pull/4#issuecomment-6241831297) on the existing `feature/companion-gameplay-v1` branch.

The small policy correction permits the already-available SMART+/WOOP editors to award their once-only bonuses on parked and previously archived goals. Planning does not activate the goal, change its archive flag or bypass the existing 1–3 active-goal focus choices. Task controls and daily check-ins retain their active-goal rules. Achieved goals are rejected before reward metadata is initialized. The evolution guide states this distinction in student-friendly language.

No new fields, migration, schema changes or retroactive recalculation are added. Existing XP/stages, companion identities, unknown fields and plans remain intact. If an earlier PR build saved a completed plan with uncredited flags, submitting it again now awards the missing bonus once; subsequent submissions and activation cannot repeat it. Already credited legacy/current plans earn nothing extra.

Changed files in this correction: `js/gameplay.js`, `js/companions.js`, `tests/companion-gameplay.test.mjs`, `tests/companion-gameplay.browser.mjs`, and this report. Storage, backup/import/recovery and migration modules are untouched.

Five targeted Node regressions failed before the fix: parked and previously archived planning, previously withheld bonuses in both states, and achieved-goal metadata mutation. They now pass. New browser flows exercise parked and previously archived editors at 390 and 1365 px, repeated commitment and WOOP submissions, stage growth, retained identity/tasks/extensions, activation at three-goal capacity, explicit parking choices, downloaded backups, actual import, reload and no duplicate reward after activation or restore.

Review-fix verification:

- `node --test tests/*.test.mjs`: **65 passed**, including all prior checks and the five new regressions.
- `node --test tests/browser.mjs tests/data-safety.browser.mjs tests/goal-collection.browser.mjs tests/companion-gameplay.browser.mjs`: **41 passed** in installed Edge at 375, 390 and 1365 px, including all prior browser coverage and four targeted planning flows. The retained V4 suite still passes 42 paired DOM/state checkpoints and 12 unchanged-screen visual comparisons. Checked flows have no console errors, horizontal overflow or external requests.
- All application modules passed `node --check`; `git diff --check` passed. `state.js`, `data-safety.js`, `data-controls.js` and the frozen V4 reference have no diff from the original PR head.

Physical mobile devices, Safari and Firefox remain unverified. Stop for final review; no merge, deployment or Phase 5 work.
