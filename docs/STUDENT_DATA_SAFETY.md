# Phase 3 — Student Data Safety

Branch: `feature/student-data-safety-v1`, based on `origin/main` at `3c1e267`.

## Changed files

- `index.html`, `styles.css`: persistent backup access and accessible save warning.
- `js/data-safety.js` (new): backup envelope, validation and additive migration.
- `js/state.js`: storage locks, recovery-first atomic replacement and full export.
- `js/data-controls.js` (new): import preview, confirmation/cancellation, recovery, downloads and keyboard focus.
- `js/app.js`: composition/events, truthful unsaved-change messages, retained SMART+/WOOP extension fields.
- `js/creator-smart.js`: discoverable backup controls and explicit sample-goal loading.
- `tests/data-safety.test.mjs`, `tests/data-safety.browser.mjs` (new): unit/failure/browser coverage.
- `tests/fixtures/v4-save.json`, `tests/fixtures/v4-backup.json` (new): synthetic records captured from actual frozen V4 functions.
- `tests/modules.test.mjs`, `tests/browser.mjs`: retain V4 assertions around the explicitly changed Phase 3 contracts.
- `README.md`, `docs/STUDENT_DATA_SAFETY.md` (new): usage, design, verification and remaining risks.

## Student instructions

- Choose **Back up & restore → Download full backup**. Keep the downloaded JSON file somewhere private. It includes your personal goals and reflections.
- To restore, choose **Import Backup**, select a JSON file, and read the preview. **Replace my progress** replaces your current record; **Cancel**, Escape, the close button or tapping outside the dialog leaves it unchanged.
- Before replacement, the app saves one recovery copy in this browser. Choose **Review recovery copy** to preview and restore it. Each new restore replaces that recovery copy. To keep it separately, use **More recovery options → Download recovery backup**.
- Browser data does not sync between devices. Clearing it removes both the working save and the recovery copy. Downloaded backups remain wherever you saved them; the app does not upload them.
- If a warning says saving failed, keep the page open and download your work. Check browser storage settings/space. **Reload saved progress** asks first because reloading loses unsaved changes.
- If saved progress cannot be opened, the original is left untouched. **More recovery options → Download original saved data** keeps the exact text for possible recovery. After a confirmed restore, **Download recovery originals** keeps the previous exact record and working copy, even when the original was unreadable. Unreadable originals may need help from a trusted person; do not share them publicly.
- A new student gets an empty collection. Sample goals require an explicit, confirmed action in My Goals. Resetting to samples also requires a successful recovery save.

## Backup and migration contract

The primary key is still **`h4_goal_quest_v4`**. State schema **5** adds safety handling; it preserves the V4 field layout and every unknown compatible JSON field. V4 → V5 migration clones the record, adds defaults only for absent fields, and changes `version` to `5`. Explicit invalid/null structures are rejected, not replaced with defaults. Migration is idempotent. The exact V4 disk record is preserved before the first migrated write.

New downloads use this envelope:

```json
{
  "format": "h4-goal-quest",
  "backupVersion": 1,
  "exportedAt": "2026-10-17T16:00:00.000Z",
  "state": { "version": 5, "goals": [] }
}
```

The abbreviated `state` above is illustrative. Real exports include the entire validated working record: goals/tasks, all XP inputs and any explicit companion fields, SMART+, WOOP, Wheel, lessons, journal/evidence/reflections, drafts/schedules, navigation, focus settings, demo flag, preferences and unknown compatible fields at every depth. XP and evolution remain derived by the unchanged companion code. Editing SMART+/WOOP also retains unknown nested fields.

Accepted imports:

1. Format `h4-goal-quest`, backup version `1`, containing state version `4` or `5`.
2. Raw full V4/V5 saved records, including downloads of original saved data.
3. Actual old V4 exports (`exportedAt`, `goals`, `wheel`, `journal`, no state version). The preview explicitly warns that missing lessons, drafts and settings cannot be recovered. Missing fields receive empty defaults; existing records are replaced only after confirmation. Unknown fields present in the file are retained.
4. Small valid recovery-original envelopes, recovery version `1`, whose working state passes the same validator. For normal recovery use the downloadable **recovery backup**, which uses the standard backup envelope.

Other state/backup versions are rejected rather than guessed or downgraded. No import merges demo content into a student record. No network request, backend, AI API, build step or runtime dependency was added. The immutable V4 fixture is unchanged.

## Validation boundaries

Files are limited to **2 MiB (2,097,152 bytes)** before reading and again as UTF-8 before parsing. Known records require safe unique IDs, supported categories/screens/enums, real dates/timestamps, correct object/array/string/boolean types, valid challenge/Wheel ranges and a usable draft structure. Goal IDs and task IDs are checked for duplicates; task IDs are unique across goals because actions are addressed globally.

All values, including unknown fields, are checked recursively: depth ≤32, ≤100,000 visited values, ≤10,000 entries per array, ≤1,000 goals, strings ≤200,000 characters and keys ≤200 characters. Nonfinite/out-of-safe-range numbers, reserved prototype keys (`__proto__`, `constructor`, `prototype`) and unsafe control characters are rejected. Student text remains text and is escaped at rendering; HTML-like text is not deleted. Backups are checked against the same importer before download so an export is restorable within these limits. Raw original downloads are preservation artifacts and may exceed import limits or contain damaged data.

## Save and restore ordering

`data-safety.js` only parses, validates and migrates; it performs no storage/DOM writes. `state.js` owns the working state and storage. `app.js` remains the sole composition root; `data-controls.js` owns preview/cancellation and dialogs.

1. Parse, recursively validate and migrate the entire candidate before preview. No saved data changes.
2. Cancel discards the pending candidate. A generation token ignores file reads that finish after cancellation or another selection.
3. Confirmation revalidates/serializes the candidate and checks that both working progress and the disk record still match the preview's snapshots.
4. Save `h4_goal_quest_v4_recovery` first. It contains format/version/time, the exact previous primary text in `raw`, and the current working state (including unsaved changes) in `workingState`.
5. Check the primary again, then atomically replace the **whole** primary key in a single `localStorage.setItem`. No primary removal, field-by-field writes, or early in-memory replacement occurs.
6. Only after that succeeds, publish the candidate as the working state, stop the old session timer, render and show success. Status notification cannot turn a committed write into a reported failure.

If validation, serialization, reading, recovery saving or primary saving fails, the existing primary and working state are unchanged. A primary-write failure may leave an updated recovery slot containing the old progress; it never leaves a partial primary record. If the page closes between the two writes, the old primary remains. If it closes after the primary write, both the new primary and the old recovery exist. Recovering uses this same confirmation/save path, so undoing a restore also keeps the current record.

Unreadable/corrupt/unsupported startup records lock automatic writes and remain downloadable, without demo fallback. A confirmed valid restore can replace them only after saving their exact originals in recovery. Blocked storage starts an empty in-memory student session with a persistent warning; it cannot overwrite data it could not read. Quota failures keep working changes exportable and never claim they were saved. Detected other-tab changes lock stale autosaves/restores until reload.

## Verification

All tests use synthetic records, isolated browser profiles and loopback static hosting; no real student data or production storage was used.

- `node --test tests/*.test.mjs`: **29 passed**. Includes the unchanged frozen-reference hash and original companion/XP/evolution/momentum parity tests, plus complete round trips, nested unknown fields, real V4 save/export fixtures, migration idempotence, invalid structures/values/versions/limits, cancellation, corrupt/blocked/full storage, failure at each restore write, unsaved-work recovery, stale previews, cross-tab conflicts and safe demo reset.
- `node --test tests/data-safety.browser.mjs`: **14 browser tests** covering real import/download/recovery/refresh at **375, 390 and 1365px**; cancellation via Cancel/Escape/backdrop/close/file chooser; slow/failed file reads; a download generated by the actual frozen V4 page; injected primary/recovery write failures; corrupt/blocked storage, second-tab conflicts, no demo seeding, unsaved-draft export/messaging, retained nested extension fields, keyboard focus and no errors/overflow/external requests.
- `node --test tests/browser.mjs`: **3 passed**, with **42 paired DOM/state checkpoints and 21 visual comparisons** against V4. Full creation/SMART+/WOOP/evidence/check-in/planner/timer/calendar/lesson/copy/XP/evolution flows remain covered. Only the changed backup footer/toolbar and schema version are normalized; core content comparisons remain exact. Screenshots are taken at a common scroll position. The full new backup payload is separately asserted before its legacy subset is compared.
- `node --check` on all application JavaScript and `git diff --check`: passed.
- Mobile/desktop backup-dialog screenshots were visually inspected in installed headless Edge. Existing Playwright from the workspace runtime was used, with `PLAYWRIGHT_MODULE_PATH` and `BROWSER_CHANNEL=msedge`; no package installation was added.

Phase 2 tests were updated only where Phase 3 deliberately changes the contract: version 5, the added backup controls/styles, explicit sample reset, complete export, and empty/warning startup on blocked storage. `tests/baseline.test.mjs`, the reference HTML, all companion rules and the canonical brief remain unchanged.

## Remaining limits and review

- Local storage and the single recovery slot can both be cleared, evicted or lost with a device/profile. Private downloaded backups are still essential; no cloud sync or file encryption is supplied.
- Recovery duplicates the old disk/working record and uses additional browser quota. If there is insufficient room for both recovery and restore, restoration stops safely; it never deletes an existing save to make room.
- The comparison guards detect existing cross-tab changes, but localStorage has no cross-tab compare-and-swap transaction. Avoid editing simultaneously in multiple tabs; the final synchronous write is atomic per key, not a multi-tab locking protocol.
- Very large or incompatible records remain untouched for download/manual recovery; they are not silently trimmed. Raw recovery-original files can exceed normal import limits; use **Download recovery backup** for normal imports.
- Only installed Edge with emulated phone widths was tested. Physical mobile devices, Safari and Firefox remain unverified. The existing session-only timer, wider dialog accessibility and date/timezone hardening remain separate quality work.
- Reverting application code is an additive-schema rollback: the same V4 fields/key remain available, and the first migrated raw record is in recovery until another restore/reset replaces it. Download a full backup before any rollback.

Stop for PR review. Do not merge, deploy, enable Pages, or introduce PWA support in this phase.
