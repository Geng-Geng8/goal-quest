# Phase 7S-A — Cross-Device Sync Architecture

Status: **proposal for owner review; cloud sync is not implemented or approved for student use.**

Prepared against `origin/main` at `9f535e1877e1d7d7ce6e13871f6256166707f3f2` (Phase 6, PR #6). Review date: October 18, 2026. Source and pricing links were checked during this audit; recheck them before implementation. This document contains illustrative SQL specifications, not an applied migration.

## 1. Recommendation

Keep the existing vanilla JavaScript PWA and its local-first workflows. Add optional Supabase Auth and **one versioned progress record per authenticated student**, plus a small private submission/recovery table. Save locally first, then automatically upload a complete snapshot with the revision it was based on. The database accepts it only if that revision is still current. Otherwise it keeps the submitted snapshot as a conflict and leaves the current cloud record intact.

Use email verification codes for the initial pilot, with a working transactional email provider. Students use the **same verified email/account** on each device. Start without Google/Microsoft sign-in; add one provider only if the pilot school's account policies make that easier. Keep local-only use available and make uploading an existing record an explicit student choice.

This protects against accidental overwrite and repeated network delivery without replacing the gameplay model. It does **not** automatically combine concurrent edits: the first release asks the student to review two preserved versions. That tradeoff is simpler and safer than attempting to merge aggregate XP, un-ID'd notes, achievement decisions and task reversals.

No framework, cloud AI, teacher dashboard, public profile, file uploads, realtime service, CRDT, or general event-sourcing system is needed. A small privileged database write function is needed because browsers must not bypass the revision check. Account deletion also needs a trusted administrative operation; GitHub Pages cannot hold its credentials.

```text
Existing five tabs and gameplay
             |
      account-aware store
             |
   durable local workspace + pending snapshot
             |
  foreground sync coordinator (authenticated HTTPS)
             |
  Supabase read policies + version-checked write RPC
             |
  student_progress + progress_submissions

Service worker: verified public static files only
JSON backups: continue to work independently of accounts
```

### Alternatives considered

| Option | Benefits | Limitation / decision |
| --- | --- | --- |
| Existing local save + manual JSON transfer | No account cost; works offline | Does not meet automatic cross-device synchronization. Retain as local-only mode and recovery. |
| Complete versioned snapshot + preserved conflicts | Matches the existing state, simple downloads, transactional conflict handling | Whole-record conflicts can require a student choice. **Recommended for pilot.** |
| Per-task tables or replayable domain events | Could merge independent actions automatically | Requires stable IDs for every event, reward-ledger reconciliation, tombstones, legacy XP conversion and more backup logic. Revisit only if measured conflicts make the snapshot approach impractical. |

## 2. Audit: what actually exists

The product brief describes the V4 prototype and future intentions. Current code on main, rather than every aspiration in that brief, defines the preservation baseline.

| Area / sources | Verified from source and current Node tests |
| --- | --- |
| Composition and saves: `js/app.js`, `js/state.js` | `app.js` is the composition root. Feature code mutates the working state and calls `persist()`; `screen()` also persists after rendering. The primary key is `h4_goal_quest_v4`. `createStore()` accepts a storage adapter, useful for later namespacing. There is no account, sync queue or network persistence. |
| Data format: `js/data-safety.js` | `DATA_VERSION = 8`, backup envelope version 1. Validates and additively migrates full V4–V8 records, actual partial V4 exports and supported recovery envelopes. Retains compatible unknown JSON fields at every depth. Limits include 2 MiB UTF-8, depth 32, 100,000 visited values, 1,000 goals, 10,000 array entries, unique goal/task IDs, safe integers and dates. |
| Recovery: `js/state.js`, `js/data-controls.js` | A single `h4_goal_quest_v4_recovery` slot stores the exact prior disk text and working state before migration, import or demo reset. Replacement writes recovery first and primary last; failed primary writes attempt to restore the earlier recovery. Preview captures disk and working-state expectations. Invalid originals remain untouched and downloadable. Ordinary edits do not create a history of every save. |
| Local conflicts | Saves compare current disk text with the store's previous text and lock on an observed other-tab change. This is helpful stale-write detection, **not an atomic lock across tabs**: another tab could write between the comparison and `setItem`. There is no cross-device concurrency control. |
| Gameplay: `js/gameplay.js`, `js/companions.js` | Legacy XP = up to 300 completed tasks ×35 + up to 100 check-ins ×10 + 25 for an existing WOOP plan +20 for commitment. Lazy `g.rewards = {xp, woop, commitment}` preserves that legacy total before new credit. `rewardedAt` prevents repeat task credit; undo keeps earned XP. New task reward is 35; daily check-in 10; complete WOOP 25 once; commitment 20 once. The global journal limits new check-in credit to one day and retains the original goal attribution. Rewards are self-reported, not server-verified achievement. |
| Companions and goals: `js/companions.js`, `js/goal-status.js`, `js/goal-collection.js` | Seven families, four stages each; per-goal XP and optional nickname/accent/accessory. Stages at 0/145/290/435 XP; player level derives from total XP in increments of 170. Explicit achievement records require reflection and how the student knows; achievement adds no XP. Active/parked/achieved/legacy archived distinctions and compassionate momentum already exist. |
| Planner / timer: `js/planner.js`, `js/focus-timer.js` | Calendar export, local date strings and saved local-day reward metadata. Timer stores a wall-clock deadline/paused remaining time in `state.focus`; ticks update the display, not storage. Timer completion awards no XP. |
| Offline: `sw.js`, `js/pwa.js`, `manifest.webmanifest` | Hash-verified allowlisted static shell; relative paths support `/goal-quest/`. No private records/API replies in Cache Storage. Updates wait for existing windows to close. No background sync. Existing phone installation instructions explicitly leave physical Safari/iPhone/Android checks unverified. |
| Regressions | Seven Node suites cover baseline, modules, data safety, goal collection, gameplay, accessibility/stability and offline PWA. Six optional browser suites cover responsive workflows and real service workers using synthetic data. The original V4 fixture remains immutable. |

Audit inputs also include `AGENTS.md`, `README.md`, the complete product brief, `docs/STUDENT_DATA_SAFETY.md`, `docs/OFFLINE_PWA_V1.md` and corresponding test/support files. Existing notes/reflections are not all independently identified events, and XP is an aggregate with flags, which makes a naive array union or XP sum unsafe.

**Verification in this documentation task:** `node --test tests/*.test.mjs`: 94 passed, 0 failed, 0 skipped. This checks the existing app, not the proposed cloud design. No Supabase project, schema, RLS policy, authentication flow or physical device was tested here. Browser suites were inspected but not rerun for a documentation-only change.

## 3. What syncs

Keep the full validated V8 state as the compatibility payload. Define a small explicit set of device-local fields; everything else, including unknown compatible fields, belongs to progress unless a future schema explicitly classifies it. Do not whitelist known goal fields and accidentally discard extensions.

| Sync between devices | Keep on this device/context |
| --- | --- |
| Goals, stable existing goal/task IDs, schedules, SMART+ and WOOP | Current tab/screen and selected goal (`screen`, `selected`) |
| Task completion, first-reward timestamps/local dates, `rewards` flags and XP | Running/paused timer details: `focus.status`, `remainingMs`, `deadline` |
| Goal lifecycle, achievements, evidence text, reflections, journal/check-ins | Timer duration preference `focus.minutes` (same whole `focus` object stays device-local, including extensions) |
| Companion names/styles, lessons, Wheel ratings | `notesViewed` UI acknowledgement; install/update notices and shell cache |
| Unfinished creator draft and schedule (conflicts require review) | Account tokens, remember-device preference, workspace identity and local recovery originals |
| Compatible unclassified extension data; version and demo provenance | Pending queue, base revision, retry state, device identifier and migration receipts |

Use a **comparison-only projection** that excludes `screen`, `selected`, `focus` and `notesViewed` when deciding whether progress changed. Never serialize that incomplete projection as a save. Upload the complete validated V8 snapshot unchanged: its device fields travel as inert backup-compatibility metadata, not instructions to change another device's navigation or timer. Receiving a snapshot retains this device's effective settings; a new device starts with the existing `emptyState()` UI defaults. Do not navigate a student away, open a remote draft automatically or start a remote timer. Prove that comparison, download and export preserve unknown fields and all original backup data.

Keep device settings separately in the account workspace so a downloaded snapshot can be preserved verbatim before recomposition. Check recomposition against the existing exporter before adoption. At a size boundary, combining a large remote record with large device preferences can exceed 2 MiB even when both inputs were individually valid. Preserve the incoming record and the previous local state/settings, stop adoption and offer a review/export choice; never trim goals/extensions or silently reset settings. An explicit choice to replace device preferences must retain the previous full local backup. Include this boundary case in acceptance tests. The compatibility download of the untouched incoming snapshot must always remain available and restorable; receiving cloud progress is not equivalent to confirming a full backup import.

Authentication/sync metadata stays outside the V8 state and backup envelope. Normal full JSON downloads keep the current format and include a complete recomposed state, never tokens or another account's workspace. Each preserved conflict version has its own compatible full-state download. Do not invent an incompatible combined-backup envelope; separate cloud recovery listings can link individual exports.

## 4. Authentication and recovery

### Recommended pilot: email code

Student flow: **Create account / Sign in → email → enter code → choose device privacy mode → review existing progress if any**. First creation also requires the short cloud privacy notice and appropriate consent. Ordinary sign-in must not silently create a second account after an email typo. Use `shouldCreateUser:false` for sign-in; enable creation only through the explicit account-creation path. A successful code request is not yet a signed-in session. Configure the email template to show the code rather than relying on a link opening in the right browser/PWA. [Supabase email OTP documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless).

| Method | Ease / recovery | Privacy and practical constraints |
| --- | --- | --- |
| Email code | No app password; inbox access works on laptop and phone, including reading mail on one and typing the code on the other. Recovery means regaining that inbox. | One email is necessary; deliverability and accessible inboxes must be tested. School filters or blocked personal mail can prevent login. A school mailbox may disappear at graduation. |
| School Google | Often fewer taps on an already signed-in Chromebook; recovery administered by the school. | School may block OAuth consent or phone login. Basic provider profile data can enter Auth even if the app does not use it. Obtain approval and request only necessary identity scopes. [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google). |
| School Microsoft | Familiar on managed Windows/365 accounts; school-admin recovery. | Tenant consent and account restrictions can block it; configure the correct tenant and email identity behavior. No mailbox/calendar/Drive permissions. [Microsoft provider setup](https://supabase.com/docs/guides/auth/social-login/auth-azure). |

Recommendation is conditional on a small real-school deliverability/access test. If codes cannot reach usable inboxes, review adding the school's provider **before** a student pilot; do not build both providers speculatively. A student must use the same Supabase user ID on both devices. Never merge accounts by typed email, similar names or imported backup ownership. If another provider is added, test Supabase's verified-identity linking behavior and authenticated linking explicitly; failed links must preserve both workspaces.

Use an address students can continue to access, within school/provider age and account rules. Plan an authenticated email-change process verifying the new address, with fresh verification of the current account and notification to the old address. No staff override based only on a student's name. If the inbox is permanently lost, the honest fallback is recovery through the email provider, or a new account and a private exported backup; do not promise account recovery without proof of ownership.

Proposed settings: 10-minute code expiry, supported server-side resend/verification limits, neutral responses to discourage account enumeration, no code/token logging, and clear expired-code/retry guidance. Verify these settings and abuse limits in staging; client-side countdowns alone are not protection. Use CAPTCHA only if abuse requires it and after reviewing its student privacy impact. Disable unused password, phone, anonymous-account and social providers. No SMS or phone number collection is required.

Use custom SMTP with verified sending domain/SPF/DKIM/DMARC, disabled tracking, transactional templates only and a privacy-reviewed provider. Supabase's built-in sender is restricted to project-team addresses and is unsuitable for student delivery. [Supabase SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp). No student mailing list, advertisements, engagement campaigns or marketing consent bundled into account creation.

### Sessions and shared school computers

An account namespace prevents accidental app mixing; it does **not** make readable browser files confidential from another person using the same browser profile. Shared mode must therefore avoid persisting student data there.

* Default: **Shared school computer**. Tokens, downloaded progress and offline edits exist in memory only. Refresh/close requires login again; warn before unsynced work is closed and offer a private download. Offline editing works while the open session remains available, but cannot promise recovery after closing. Do not put tokens in localStorage, sessionStorage, IndexedDB or the worker cache in this mode. Add an inactivity lock that removes the private view and requires verification to reopen; proposed 15 minutes, subject to school review. Preserve pending memory work behind the lock until verified as the same user or explicitly discarded/exported.
* Opt-in: **My private device — keep progress offline here**. Persist the account workspace and session with an account/project-specific auth storage adapter. On reload while offline, explicitly identify whose saved private-device workspace is being opened. This relies on OS/browser-profile privacy, not a local PIN or encrypted-looking UI. Anyone with that unlocked profile may access it. A shared computer needing durable offline work requires separate OS/browser profiles or a separately approved encryption/unlock design.
* Always show the active account (a restrained email label in account settings) and device mode. Never auto-select a cloud owner from the legacy save. Signing into B must never attach A's pending work, recovery, forms or timer to B.
* On logout/account switch: stop sync and timer callbacks, increment a session/workspace generation, abort requests, close private dialogs, clear rendered private content and in-memory references, and tell other app tabs to lock. Every callback checks the captured user ID **and** generation before updating any state. Late A replies are discarded after switching to B.
* Default logout removes that account's device workspace, recovery, queue and auth tokens after a successful cloud save. With unsynced work, offer **sync and sign out**, **download then remove from this device**, or **cancel**. Offline sign-out clears local credentials immediately but cannot promise server revocation until online. Never silently delete pending edits. Downloads are outside the app's control; warn shared-device users that files can remain in Downloads.

Supabase access JWTs can survive logout/deletion until expiry. Require a server check that their `session_id` still exists for this user on **all progress reads and writes**, in addition to RLS ownership; configure a short, supported JWT lifetime (proposed 15 minutes). Other devices should remain signed in for normal device-local logout; provide a separate clearly labelled all-devices action for loss/theft. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [account deletion caveats](https://supabase.com/docs/guides/auth/managing-user-data).

## 5. Database and exact isolation policy specification

### Two app tables

Store canonical compact JSON as **text**, so a supported record at exactly 2 MiB is not rejected because PostgreSQL JSONB pretty serialization added spaces. Parse/validate its contents server-side; do not store HTML or execute text. The write request transports this text as a JSON string, so escaped HTTP size can exceed 2 MiB: measure gateway/request limits with worst-case fixtures. A transport failure must leave the local state and queue intact. Full semantic validation remains required; these table checks alone are insufficient.

```sql
-- SPECIFICATION ONLY: all SQL in this document awaits an implementation PR.
create table public.student_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision between 1 and 9007199254740991),
  protocol_version smallint not null check (protocol_version = 1),
  data_version smallint not null check (data_version = 8),
  state_text text not null check (octet_length(state_text) <= 2097152),
  last_request_id uuid not null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(state_text::jsonb) = 'object'),
  check ((state_text::jsonb ->> 'version') is not distinct from '8')
);

create table public.progress_submissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  base_revision bigint not null check (base_revision between 0 and 9007199254740991),
  result_revision bigint not null check (result_revision between 1 and 9007199254740991),
  outcome text not null check (outcome in ('accepted', 'conflict')),
  protocol_version smallint not null check (protocol_version = 1),
  data_version smallint not null check (data_version = 8),
  payload_sha256 bytea not null check (octet_length(payload_sha256) = 32),
  state_text text check (state_text is null or octet_length(state_text) <= 2097152),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (user_id, request_id),
  check (outcome <> 'conflict' or resolved_at is not null or state_text is not null),
  check (state_text is null or jsonb_typeof(state_text::jsonb) = 'object'),
  check (state_text is null or (state_text::jsonb ->> 'version') is not distinct from '8')
);
create index progress_submissions_owner_time
  on public.progress_submissions (user_id, created_at desc);
```

`state_text` contains the complete compatibility snapshot described above. `revision` is a server-controlled monotonic concurrency token, separate from state `version`, backup version and sync protocol version. Base revision 0 means “create only if no cloud record exists.” The second table holds retry receipts and recoverable accepted/conflicting snapshots. A compacted receipt may retain the hash/outcome without its older accepted payload. Never compact an unresolved conflict.

No separate profiles/rosters or redundant email columns. `auth.users` contains authentication identity; progress ownership is the immutable UUID. Local goal/task IDs are not replaced with database IDs. Do not send a stable hardware identifier; request UUIDs are enough.

### Privilege boundary and RLS

Browser roles receive **SELECT only** on these tables. Writes use one reviewed RPC, not direct `upsert`, PATCH or DELETE. A normal invoker RPC cannot write if its caller has no write grants. Therefore use a deliberately narrow private `SECURITY DEFINER` implementation owned by `h4_sync_writer`, a **NOLOGIN, NOINHERIT, NOBYPASSRLS** role that owns neither table and is not granted to `anon`, `authenticated` or `authenticator`. It has only the table operations below and the session columns required for verification. This preserves RLS inside the privileged operation, unlike a function owned by `postgres` or a bypass-RLS role. The public wrapper remains `SECURITY INVOKER`.

The exact policy expressions and grants to carry into the implementation migration are:

```sql
create role h4_sync_writer nologin noinherit nobypassrls;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, h4_sync_writer;
grant usage on schema public, auth to h4_sync_writer;
grant execute on function auth.uid(), auth.jwt() to h4_sync_writer;
grant select (id, user_id) on auth.sessions to h4_sync_writer;

-- Owned by the restricted writer, not a table owner or postgres.
create function private.has_current_session() returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from auth.sessions s
    where s.id = ((select auth.jwt()) ->> 'session_id')::uuid
      and s.user_id = (select auth.uid())
  );
$$;
alter function private.has_current_session() owner to h4_sync_writer;
revoke all on function private.has_current_session() from public, anon;
grant execute on function private.has_current_session() to authenticated, h4_sync_writer;

alter table public.student_progress enable row level security;
alter table public.student_progress force row level security;
alter table public.progress_submissions enable row level security;
alter table public.progress_submissions force row level security;

revoke all on public.student_progress, public.progress_submissions
  from public, anon, authenticated;
grant select on public.student_progress, public.progress_submissions to authenticated;
grant select, insert, update on public.student_progress, public.progress_submissions
  to h4_sync_writer;

create policy progress_read_own on public.student_progress
  for select to authenticated
  using ((select auth.uid()) = user_id and (select private.has_current_session()));
create policy submissions_read_own on public.progress_submissions
  for select to authenticated
  using ((select auth.uid()) = user_id and (select private.has_current_session()));

create policy progress_write_own on public.student_progress
  for all to h4_sync_writer
  using ((select auth.uid()) = user_id and (select private.has_current_session()))
  with check ((select auth.uid()) = user_id and (select private.has_current_session()));
create policy submissions_write_own on public.progress_submissions
  for all to h4_sync_writer
  using ((select auth.uid()) = user_id and (select private.has_current_session()))
  with check ((select auth.uid()) = user_id and (select private.has_current_session()));
```

The writer has no DELETE grant despite its ownership policy covering all commands. Retention is a separate restricted maintenance operation. Verify actual table ownership, role attributes/memberships, `auth.sessions` column access and function ownership in staging. Grant any temporary CREATE permission required to assign function ownership only inside the migration transaction, then revoke it. Do not leave the writer able to create/replace functions or tables. The session helper returns only a boolean for the current JWT; it cannot list users/sessions. Missing/malformed session claims fail closed.

After defining the functions in that later PR, use these exact signature grants (bodies intentionally not implemented here):

```sql
-- Arguments: expected revision, immutable request UUID, compact state text,
-- protocol version. No caller-supplied owner ID.
alter function private.write_progress(bigint, uuid, text, smallint)
  owner to h4_sync_writer;
revoke all on function private.write_progress(bigint, uuid, text, smallint)
  from public, anon;
grant execute on function private.write_progress(bigint, uuid, text, smallint)
  to authenticated;
revoke all on function public.sync_progress(bigint, uuid, text, smallint)
  from public, anon;
grant execute on function public.sync_progress(bigint, uuid, text, smallint)
  to authenticated;
```

Both functions fix `search_path = ''` and fully qualify references. The public function is a thin SQL invoker wrapper calling the private definer function; `private` is never an exposed Data API schema. Do not use user-editable metadata, email, school domain or a frontend role flag for authorization. No permissive views, GraphQL side door, Realtime publication or Storage bucket is needed. If a conflict-resolution RPC is added, give it the same boundary and ownership checks on **every** supplied request ID.

RLS controls rows; grants control API access, and both are required. Supabase's [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) requires explicit grants for newly created tables (rollout to existing projects October 30, 2026). Do not “fix” permissions by granting all commands or disabling RLS. Consult [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [function privileges](https://supabase.com/docs/guides/database/functions) and [API hardening](https://supabase.com/docs/guides/api/securing-your-api).

### Transactional write contract

The later RPC must implement the following as **one database transaction**, with structured outcomes rather than treating an empty response as a successful save:

1. Derive the owner from `auth.uid()`; reject null, invalid/inactive sessions and unsupported protocol versions. Never accept an owner parameter. Validate base revision and request UUID. Use a transaction-scoped per-user advisory lock derived from that UUID (hash collisions only serialize unrelated writes); it covers both initialization and subsequent writes.
2. Check input byte limits and recompute SHA-256 from the received UTF-8 text **on the server**. For an existing `(owner, request_id)`, require the identical payload hash, base and protocol. Return the original receipt before applying new-submission quotas; a reused ID with different input is an error. Clients cannot supply or change an authoritative hash, revision, timestamp, outcome or XP increment. Apply request-rate limits without altering an already committed result.
3. For a new request, enforce per-account conflict/byte quotas and validate the entire snapshot against the V8 semantic/recursive safety contract, including unique IDs, reward metadata, achievement relationships and exportability. Write a parity-tested SQL validation routine, not just a JSON syntax check. Preserve unknown safe fields. PostgreSQL JSONB alone accepts numbers outside JavaScript's safe range, so validate them explicitly. Reject invalid/unsupported data without modifying the head or any existing recovery.
4. For no head and base 0, atomically create revision 1 and its accepted submission. Two first-device migrations serialize: exactly one creates the head. The other becomes a preserved conflict against revision 1.
5. For an existing head at the supplied base, insert the accepted submission and replace the head at `revision + 1`, assigning the new request ID and server time. Include the revision predicate in the update as an extra guard. An identical new snapshot may advance the revision but never adds XP. Client comparison avoids redundant submissions; keep server semantics uniform rather than introducing a second no-change receipt protocol.
6. If the head has advanced, store the submitted candidate with `outcome:'conflict'`, its base and observed current revision. Return conflict ID and head revision, never overwrite the head. A future/nonexistent base is an invalid request. A conflict is a **committed result**, not an exception that rolls back its preserved snapshot.
7. Receipt, snapshot and head changes either all commit or all roll back. Timeouts after commit are retried with the same UUID/text/base. Permission, validation or quota failure must not acknowledge or remove local pending work.

Implement request deduplication before mutating anything and recheck session validity at the authorization boundary. Return bigints safely within the specified JS-safe range. The client must fetch the current head after a duplicate receipt; an old success receipt does not prove that its snapshot is still current.

Retention proposal: keep the current head, the most recent **three accepted submission payloads** per account, retry metadata for 90 days, unresolved conflicts until explicit review, and resolved-conflict payloads for 30 days. Compaction clears older accepted payloads but keeps their receipt hashes during the retry window. If an old receipt has expired, its old base is stale and the retry becomes a conflict; it must never replay an XP delta. Cap unresolved conflicts at 10/account initially and total retained payloads at 64 MiB/account; refuse additional submissions visibly while retaining local candidates if the limit would be exceeded. Do not evict unresolved work to make room. Retention/quota values require owner approval and measured pilot sizing.

## 6. Local-first synchronization protocol

### Local durability and ownership

Retain `h4_goal_quest_v4` and its recovery key for existing/local-only use. Account workspaces use a **new IndexedDB database** keyed by Supabase project identity plus user UUID; do not repurpose the global legacy key as whichever account is signed in. IndexedDB transactions atomically store working state, recovery, acknowledged base snapshot/revision, current local sequence, immutable in-flight request and newer pending snapshot. Storage failure keeps work in memory/exportable and stops uploads of uncommitted local work. Test Safari IndexedDB failure/private mode/quota cases.

IndexedDB is justified here because localStorage cannot atomically commit a state record and separate outbox metadata, nor safely serialize competing tabs. Keep native browser APIs and a small explicit adapter; no general sync library. Local-only mode can keep the existing store behavior until a separately scoped improvement. `app.js` remains the composition root and feature modules still receive a store; introduce focused `auth.js`, `account-store.js`, `sync.js` and optional `sync-controls.js` rather than rewriting gameplay.

Each durable mutation reads the workspace generation/sequence inside a read-write transaction and commits only if it still matches the view being edited. A stale tab preserves its candidate and asks for reload/review, rather than retrying its full stale state. BroadcastChannel/storage notifications can announce changes, but are not the lock. Reconcile open forms, drafts and paused timers before replacing their store. Test two tabs without Web Locks or BroadcastChannel as well as with them.

### Normal save/reconnect

1. Existing gameplay runs once against the local working state. Validate/export-check and commit working state plus pending progress snapshot locally. Only after successful transaction completion say **Saved on this device**.
2. Compare the progress projection with the last queued/acknowledged projection. Navigation, timer ticks and UI acknowledgement do not enqueue cloud writes. Debounce real edits (proposed 2 seconds, maximum 10 seconds while active) and flush after explicit saves/online/visibility return. Local durability is immediate; network debounce never postpones the local save.
3. With a validated active session and connectivity, fetch the head. If local work is clean, validate downloaded data and persist a local recovery/base transaction before adopting it. If dirty, never replace it: send its candidate with its **original base revision**, even if a newer head was just discovered.
4. Persist a fresh request UUID and immutable payload/base before sending. One in-flight request per workspace across tabs. Later edits update a distinct pending snapshot; never mutate the in-flight request or call gameplay again to reconstruct it.
5. On acknowledged acceptance, persist the new base and receipt. If the local sequence still matches the sent sequence, mark it clean. If later local edits exist, keep that newer working state and send its full snapshot next, based on the accepted revision. If another device committed meanwhile, the next attempt conflicts safely.
6. A failed response leaves the exact in-flight request pending. Retry network/429/5xx failures with exponential backoff and jitter (proposed 1–60 seconds, honor Retry-After). A 401 pauses for renewed sign-in as the **same UUID**. Permission/validation/version/quota errors stop automatic retries and offer safe help/export. Use fetch success, not `navigator.onLine`, as proof the service is reachable.
7. Check on startup, sign-in, reconnect and foreground return, plus a modest visible-tab poll (proposed 30 seconds, lightweight revision read; download state only when changed). Stop polling when hidden/signed out. New remote work is adopted only if locally clean and no private form contains unsaved input; otherwise preserve it and offer review. Do not force reloads or discard open input.

Automatic sync runs while the app is open/foregrounded or when it next resumes. iOS/Android may suspend it; **no promise to sync while closed**. Pending work survives restart only in private-device mode. Never depend on Background Sync, a timer firing in the background, `beforeunload`, or an unreliable final request. Keep Supabase traffic outside the static worker's cache; use no-store fetch behavior for private API reads.

### Simultaneous editing and review

Example: laptop and phone both start at revision 12. Laptop commits an edited plan as 13. Phone submits an offline task completion based on 12. The server keeps the phone's candidate as a conflict; revision 13 stays unchanged. The phone displays **Two versions need review. Both are kept.** Other devices discover unresolved conflicts when they next synchronize.

Preserve the candidate, acknowledged base and current working state locally as well. Pause outgoing sync for that workspace; local editing may continue, visibly pending. The review dialog labels **This device** and **Cloud version**, shows affected goals/action counts and XP as context, offers private downloads of both, and offers **Use cloud version**, **Use this device's version**, or **Decide later**. Explain that choosing one version does not combine edits. If the student needs changes from both, keep both snapshots and allow copying from the preserved view; a guided per-goal merge is a later feature, not an implied capability of this proposal.

Before a choice commits, revalidate the local sequence and the cloud revision shown in that preview. Use cloud: transactionally preserve the latest local candidate, adopt the validated cloud version and mark the specific conflict resolved. Use device: issue a **new** request at the exact reviewed cloud revision, preserving the displaced cloud snapshot through retained submissions. If either changed during review, refresh the preview and keep both. A “force save” without a revision check is forbidden. Resolve only the selected account-owned conflict IDs after the chosen state is durably accepted/adopted; resolution RPCs must be idempotent and revision-checked too. Do not resolve a newer conflict automatically.

No automatic last-writer-wins, clock-based ordering, deep object merge, `max(xp)` reconciliation, summing XP totals, union of journal arrays, or cloning goals to preserve both. Those choices can lose edits, revive deleted fields or double-count rewards. Full snapshot review is an explicit, recoverable choice. If conflict frequency or review comprehension is unacceptable in the pilot, stop rollout and scope a richer domain merge protocol.

### XP replay guarantee and its limits

The queue sends **the result of a local action**, not “award 35 XP” or “toggle this task.” Retrying a request cannot execute `toggleTask`, `rewardPlan` or `saveCheckin` again. The server never adds the incoming XP to the stored XP. Two offline completions of the same task become two competing snapshots; choosing one retains one reward. Undo/re-complete retains `rewardedAt`, `rewardedDate`, plan flags and aggregate XP. Daily credit remains attached to its original journal day/goal; importing or syncing must not initialize a second credit.

Legacy XP remains exact; do not regenerate reward totals from task counts on download or overwrite a lazy rewards record. Restoring an older backup remains an explicit replacement and may revert XP/history just as it does today; it is never added to existing totals. This design prevents **accidental duplicate delivery credit**, not a student deliberately editing their own JSON to claim XP. Server-authoritative achievement/anti-cheat would require a different product and migration; do not claim it here.

## 7. Existing-data adoption, imports and rollback

Account creation is separate from permission to upload local progress. The legacy save has **no reliable owner identity**, particularly on a shared browser.

1. Before opening an account workspace, inspect legacy data without changing it. If nonempty, show “This browser has progress. Is it yours?” and a preview only through a deliberate local-data action; never automatically display/upload it to a newly signed-in student. “No / not sure” leaves it untouched and excluded. Demo records are identified and never automatically adopted into a real account.
2. If the student claims it, offer a full private backup, validate with the existing parser/migrator and preserve exact primary/recovery text in an account-local migration recovery artifact. Record the verified owner, project, source fingerprint and completion receipt outside V8 data. Copy, do not move or delete, the legacy keys at this stage. No confirmation or failed validation/storage means no adoption.
3. Check the cloud record using the verified account. Empty account: create from the adopted snapshot with base 0. Existing cloud progress: default to opening cloud work; offer explicit review of the claimed local version. Never treat either as a demo or silently concatenate them. Preserve both before replacement.
4. A crash or second-device race repeats the immutable migration request safely. A local migration marker is not proof of server success; require the returned receipt/head. Repeated login or another account must not rerun migration or upload the same legacy source without a new deliberate claim.
5. After confirmed cloud adoption, explain that a separate old browser save still exists. On a shared computer, offer its explicit removal **after** verified backup/cloud save; keep it out of future account UIs until removed. The app cannot establish who originally wrote unowned legacy data. Do not label that leftover data protected by login. A stale Phase 6 tab can still edit those keys; coordinate a close/reopen transition and treat any later legacy change as a new unclaimed candidate, never auto-sync it.

Existing V4–V8 full/partial/recovery imports keep their validator, warnings and preview/cancel semantics. In a signed-in workspace, import replaces **that account's local working state only after confirmation** and then queues a version-checked cloud snapshot. Tell the student it will replace their synced progress too; never upload before that confirmation. Save recovery first transactionally. Demo reset in an account requires the same explicit cloud-replacement warning or a separate disposable demo workspace; recommend the latter. Do not upload sample goals into an existing account automatically.

All raw originals, unknown safe fields, maximum-size records and compact fallback downloads remain supported. A record too large for a real transport/DB quota stays locally usable/exportable with a truthful sync error; **transport of every supported 2 MiB record must pass before release**, not become a silent compatibility exception. Old clients cannot understand sync metadata or newer protocols: refuse incompatible cloud writes, keep local exports, and prompt to close/reopen for the verified update. Do not downgrade schema or overwrite cloud with an empty fallback state.

Rollback: disable new cloud writes/account entry in a reviewed release while retaining existing account-workspace access/export and queued snapshots. Rolling back directly to Phase 6 would make new IndexedDB workspaces invisible, so it requires a prepared account-aware recovery/export bridge first. Never “roll back” by clearing IndexedDB, legacy keys, recovery, Auth users or cloud rows. A configuration flag is not a security control; server write controls must enforce an emergency pause too.

## 8. Privacy, security and operations

These are **planned release requirements**, not verified protections. RLS tests address one student accessing another; they do not prove browser privacy, XSS resistance, legal compliance or safe school deployment.

| Risk | Required mitigation / remaining limitation |
| --- | --- |
| Sensitive youth content | Goals/Wheel/reflections may reveal health, family, beliefs or third-party names. Store only necessary progress and verified email; no date of birth, legal name, school roster, photos, contacts or location required. Evidence remains text/reference, not uploaded files. Teach students to avoid unnecessary sensitive details. |
| Consent and school governance | Provide a short teen-readable notice before cloud opt-in: what uploads, purpose, provider/location, who can access, device risks, retention, deletion/export and privacy contact. Keep local-only usable without coerced account creation. Review age eligibility and meaningful consent with the school/qualified privacy adviser; do not assume “13+” removes all obligations. Canadian OPC guidance considers youth maturity and generally parental consent below 13. US availability needs a separate COPPA applicability review. [OPC consent guidance](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/appropriate-handling-of-personal-information/collecting-personal-information-and-consent/consent/gl_omc_201805/), [FTC children's privacy](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy). |
| Data residency | Recommend Canada Central (`ca-central-1`) for a Canadian pilot, subject to school approval and availability. Review DPA, subprocessors, Auth/log/backup/support access and SMTP location as well as database region. A Canadian database region alone is **not** a promise all processing stays in Canada. [Supabase regions](https://supabase.com/docs/guides/platform/regions). |
| Access by adults/operators | No teacher, mentor, parent or class visibility by default; no searchable profiles or email directory. Only the student owns app rows. Infrastructure administrators can still access hosted data using privileged tools; disclose this and restrict owner/admin access, require admin MFA and minimize support access. This is not end-to-end encryption. |
| Browser compromise / GitHub Pages | Use escaped/text rendering and re-audit downloaded/imported fields; avoid student-controlled HTML, external scripts/fonts and URL auto-fetching. Review a CSP compatible with static hosting, with exact Supabase connect target and a tested necessary image/style policy; GitHub Pages meta CSP cannot replace every HTTP header. No goals/tokens in URLs, console logs, analytics, crash reports or service-worker caches. Same-origin Pages projects share browser storage: namespace by app/project, and use a dedicated trusted origin for real students if other content on that origin is not equally trusted. Namespaces are not an origin security boundary. |
| Credentials and supply chain | Browser receives only project URL + publishable key; that key is public and does not authorize access without RLS. Never service-role/secret keys, DB passwords, provider secrets or SMTP credentials in GitHub/public assets. Store privileged secrets only in approved server/admin environments. Prefer the official Auth client to handwritten refresh/token handling; see the dependency decision below. |
| Retention and server backup | Propose no silent deletion of active student progress; 12 months of inactivity before a notice/grace process (30 days) and deletion, subject to approved policy. Operational service notices only, no marketing. Cloud conflict/receipt retention is specified above; publish its limits. Backups/logs require defined retention and a restore drill. Deleting live rows is not instantaneous removal from provider backups; disclose the verified provider expiry and ensure a restored backup does not revive deleted accounts. Retain a minimal deletion suppression record outside restored datasets only if necessary, with separately approved retention and access. |
| Student deletion request | Offer full export then fresh-account verification and confirmed deletion. A narrowly scoped trusted admin operation verifies identity, revokes sessions and hard-deletes that Auth user; FK cascades remove both app tables. No service-role key in the browser. A pilot can use a documented privacy-contact workflow with an administrator, if timely and tested; self-service Edge Function may follow in its own PR. Request fresh verification before deletion; a stale ordinary bearer token alone is insufficient. Test session checks deny old tokens and prevent stale queues resurrecting deleted records. Explain that other offline devices/backups/downloads cannot be remotely erased; clear them when next opened if deletion is detected. |
| Outages / data loss | Local transactions, cloud receipts, preserved conflicts and private JSON exports are separate safeguards. They do not stop browser eviction or hardware loss before sync. Monitor aggregate errors/quotas without recording goal content; provide a support/incident process and a database restore drill using synthetic data. Never request student backups in public issues. |

### Dependency decision requiring explicit approval

The existing app forbids runtime dependencies without express owner approval. Supabase approval does not silently approve a remote CDN or a build pipeline. Recommend a **pinned, locally vendored browser ESM distribution of the official Supabase Auth/client code**, with its license, reviewed transitive modules, source/version/integrity record and update procedure checked in. Prove it runs with native modules and the existing static server, and include it in the verified shell. No runtime CDN and no student-facing package install/build command. This is an approval request for the later implementation, not a dependency added by this PR.

First perform a small packaging spike using synthetic accounts: verify that a maintainable browser-ready artifact can actually be vendored at the approved version and check size/offline behavior. If it requires a bundle-generation maintenance tool, return that exact proposal for approval; do not quietly add a bundler. Native fetch for the small Data API RPC is straightforward, but hand-writing robust Auth refresh/session logic just to claim zero dependencies is a poor security tradeoff. Owner may instead approve a narrowly scoped official SDK packaging exception.

### Forking remains straightforward

Future setup documentation must make local-only the default when no cloud config exists. A fork should:

1. Run the existing files unchanged on a static server with no account configuration.
2. Independently approve its privacy/age/retention/region policy and create **its own** Supabase project; never reuse H4's public project URL/key just because the key is publishable.
3. Apply the reviewed schema/functions/RLS and synthetic two-account isolation tests to that project. Configure Auth/SMTP and only approved login providers. Privileged config stays in that project's dashboard/server secrets.
4. Copy a future `sync-config.example.js` to a local public config module containing only its project URL, publishable key and feature flag. Treat config as public and tie IndexedDB/token namespaces to the project identity. Changing projects must not replay queued work into the new project.
5. If OAuth is enabled, register the provider's callback at the fork's Supabase project and the exact app return URL such as `https://OWNER.github.io/REPO/`. Keep relative frontend paths; never allow arbitrary production redirect wildcards or return URLs. Code-based login avoids a link callback dependency. Remove auth callback parameters before private rendering and test installed contexts. [Redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
6. Review CSP/connect allowlists, local SDK provenance and offline asset hashes; publish only after that fork's security/device gates pass. Development test config must never connect CI or a PR preview to real student accounts. Export/import remains the portable path between projects; it does not transfer identities or silently associate accounts.

## 9. Expected initial pilot cost

Budget assumptions, not a quote: 50–100 students, text-only records averaging 50 KiB, ten cloud commits and about twenty full downloads per student/day, visible-tab revision polling, no attachments/Realtime. At 100 students, head plus three retained accepted payloads is roughly **20 MiB**; metadata, conflicts, indexes, Auth and database overhead add to that. Twenty daily full downloads are about **2.9 GiB/month** before protocol overhead; measure actual polling/response egress. At the supported 2 MiB record limit, four copies for 100 students are about **800 MiB**, so Free cannot be assumed adequate.

| Environment | Expected monthly budget (USD, before tax/FX) |
| --- | --- |
| Synthetic development | Supabase Free $0, subject to quotas; not a dependable student-service commitment. |
| Small real pilot | Supabase Pro from $25 for one Micro project; budget $25–35 total including a provisional $0–10 transactional email allowance. Email price is an owner budgeting allowance, not a verified provider quote. |
| Additional always-on staging | Budget roughly $10 extra for another Micro project; keep synthetic testing separate and confirm actual organization billing. |

Current published allowances: Free has 500 MB database, 5 GB egress and 50,000 monthly active users, pauses after a week of inactivity and has no automatic database backups. Pro includes 8 GB database disk, 250 GB egress, 100,000 MAU, daily backups retained seven days and compute credit covering one Micro. These are allowances, not performance guarantees. [Supabase pricing](https://supabase.com/pricing).

Recommend Pro for a real pilot plus verified SMTP delivery and a restore drill. No paid storage, Realtime, custom domain or point-in-time-recovery add-on is assumed. Use available spend controls and aggregate alerts, review database size/conflict growth/egress weekly, and verify uncovered charges/additional projects/taxes before purchase. Free is reasonable for synthetic development; its inactivity pause is especially awkward over school breaks. Student app access remains free.

## 10. Reviewable implementation roadmap

Each PR starts from current main, retains the immutable V4 fixture, uses synthetic data and remains gated off for students. Backend provisioning/migrations and any deployment require separate explicit approval after this architecture review. Run current Node regressions for each affected area and all browser regressions before release; do not rewrite tests to normalize data loss.

| PR | Scope | Required acceptance evidence |
| --- | --- | --- |
| 7S-B1: Auth foundation and database boundary | Approved client packaging spike; public config example/local-only default; synthetic Auth; tables, validation, restricted RPC, RLS/session checks; security/owner docs. No local adoption or automatic cloud sync. | Two real test users and anonymous API calls pass the isolation matrix below; DB constraints/function owners/grants inspected; unauthenticated RPC and direct writes denied; revoked-session requests denied; secrets scan; SMTP code delivery and expiry tested on school/phone. Plain static serving and SDK offline availability demonstrated. |
| 7S-B2: Account workspaces and existing data | Native IndexedDB adapter, memory-only shared mode, account switching/logout, exact legacy recovery and explicit adoption; V8 import/export parity. | A→B→A, expired login and offline restart never mix records; exact legacy keys unchanged until explicit cleanup; V4–V8/partial/recovery/unknown/max-size fixtures round-trip; two tabs, blocked storage and crash injection cannot lose acknowledged local work. Concurrent first account adoption preserves the loser. |
| 7S-B3: Durable sync and conflicts | Transactional outbox, immutable request receipts, head revisions, foreground retry/poll, recoverable conflict review. | Laptop/phone stale-base race and same-base DB concurrency preserve both; dropped responses/restarts do not duplicate XP; edits during upload survive; wrong-owner late responses ignored; receipt expiry, resolved history and quotas fail safely. All max-size transport tests pass. No unresolved-conflict eviction. |
| 7S-B4: Student-facing status and account controls | Small status beside existing save/install controls; accessible account/privacy/help and conflict UI; separate deletion workflow. | Distinguish local saved from server confirmed; no additional primary tabs; keyboard/screen-reader and 375/390px overflow checks; status stays calm and does not steal focus; student comprehension test of “two versions” and shared-device choice. Deletion/export/support exercise completed with synthetic accounts. |
| 7S-C: Pilot readiness | Real device matrix, school network test, independent security review, privacy/retention/incident checklist and restore/rollback rehearsal. | Signed evidence for each release gate, exact device/browser/test URL recorded; owner approval before student enablement/deployment. A small supervised pilot precedes wider availability. |

B3 should include a minimal truthful internal status while its flag is off; the polished student wording in B4 does not excuse silent failures earlier.

### Exact isolation/adversarial test matrix

Automate database tests (transactional pgTAP or equivalent SQL assertions) **and actual REST/RPC calls with test-user JWTs**. Tests run as `postgres`/service role do not establish isolation. Seed A and B with clearly distinct synthetic records and keep tokens out of logs. Anonymous means publishable key without a user JWT; also test forged/expired JWTs and disabled anonymous Auth.

| Actor / operation | Expected result and invariant |
| --- | --- |
| Anonymous SELECT, RPC, insert, upsert, PATCH, DELETE on either table | No record exposed; permission/auth failure. No mutation. |
| A SELECT without a filter, explicit B filter, guessed request UUID, range/count, embedded relationships | Only A rows returned; B rows/content/count cannot be inferred through an owned-record endpoint. Test both head and submission payload/receipt reads. |
| A direct INSERT/UPDATE/UPSERT/DELETE, including A rows | Permission denied because browser has SELECT only. This proves CAS cannot be bypassed via the REST table endpoint. |
| A direct write with `user_id=B`, or attempt to change row owner | Denied, B unchanged. |
| A calling each RPC with legitimate input | Only A's head/receipts can change. Client cannot set B owner, revision, outcome or server timestamp. |
| A supplying B conflict/request IDs to resolution/export helpers | Reject without exposing/mutating B. Explicitly test mixed arrays containing A and B IDs. |
| RLS unit test under `h4_sync_writer` with A's JWT claims | A-owned reads/inserts/updates permitted by policy; B-owned rows invisible and INSERT/reassignment fails `WITH CHECK`. Production users cannot assume this role. |
| A changing `user_metadata` to claim B/admin/teacher | No expanded access. |
| A token after revoked session/deletion; malformed/missing session claim | Both SELECT policies and RPC deny; no resurrected head/submission. After account deletion FK cascade removes both tables. |
| A versus B reusing the same request UUID | Independent account-scoped receipts; no cross-account data/result leak. |
| Forged hash, same request ID with changed text/base, out-of-range revision/version | Server recomputation/rejection, no change to original receipt/head. |
| Views, default grants, RPC discovery, exposed schemas, role memberships | No alternate writable/readable route, no public EXECUTE on privileged bodies, no BYPASSRLS/table-owner writer. Inspect catalog plus API behavior; run Supabase Security Advisor. |

Also test unsupported future state/protocol, unsafe prototype keys/control characters, invalid dates, duplicate IDs, missing achievement fields, deep JSON, unsafe JS numbers, huge/escaped/multibyte payloads, and rate/quota abuse. A safe denial must not truncate a snapshot or destroy an earlier conflict.

### Data-loss, gameplay and device tests

* Concurrency: two clients from the same base, simultaneous first writes, local dirty versus remote dirty, conflict created while review is open, local edits after preview, same-workspace multi-tab interleavings and a suspended old client returning after an update. Exactly one expected-base write wins; every rejected candidate remains recoverable or pending locally if server persistence failed.
* Delivery: server commits then reply drops; retry before/after another device commits; crash before sending, after sending and before recording acknowledgment; outbox compaction; receipt pruning; throttling; airplane mode; captive portal; DNS failure; expired/refreshed tokens. No false “up to date” status.
* Rewards: same task completed on both devices offline, undo/re-complete, two same-day check-ins on different goals, WOOP/commitment repeated on both, legacy capped XP then new reward, achievement and parked/reactivated goals. Never sum competing totals or replay gameplay for a network retry. Preserve all seven families/28 forms.
* Recovery: every V4–V8 fixture including unknown nested fields and exact 2 MiB boundaries; partial V4 warning; restore/cancel/demo; corrupt originals; disk full/blocked/evicted IDB; crash around each migration/import transaction; rollback/export bridge; account deletion with stale devices. Verify backups contain no tokens/sync internals or other users' data.
* Shared privacy: A logs out while a request/form/timer/file read is pending, B signs in, A's late result arrives; all other tabs/PWA contexts lock. Inspect localStorage, sessionStorage, IndexedDB, Cache Storage, browser history and logs for memory-only mode. Check downloaded files remain a disclosed user responsibility. Test locked pending work cannot reopen under B.
* Physical devices: school laptop browser (Chrome/Edge/managed Chromebook as applicable) paired with iPhone Safari **and** installed home-screen PWA; then Android Chrome **and** installed PWA. Repeat online/offline editing and review both directions, app kill/reopen, storage separation, blocked mail/OAuth, reconnect and verified worker update. No assumption that browser and installed app share storage/session. Use an approved HTTPS synthetic test host, never publish one implicitly.
* Regression UX: Today, My Week, My Goals, Learn, Coach; five-step creator and resumed draft; SMART = Specific, Measurable, **Agreed Upon**, Realistic, Timely; SMART+; WOOP = Wish, **Opportunity**, Obstacle, Plan with if–then; Wheel; timer; .ics; external prompt copy; achievement/collection/momentum; keyboard, reduced motion and readable status at phone/desktop widths. No embedded chatbot or hidden sharing.

Proposed status wording: **On this device only** (local-only), **Saved here · waiting to sync**, **Syncing**, **Up to date** (only after acknowledged head and no newer local work), **Sign in to continue syncing**, **Two versions need review**, and **Couldn't save here — download a backup**. Show cloud confirmation time on request; do not expose goal text in system notifications or turn a network outage into a full-screen blocker. A saved-state failure always takes priority over a cloud spinner.

### Release blockers

No students use cloud sync until all of these pass:

1. Anonymous/A/B isolation, narrow RPC privileges, session revocation/deletion and secret checks, with an independent review of the actual migration/functions.
2. Durable local/outbox transactions, same-base race preservation, lost-reply idempotency, account-switch fencing and quota/crash/data-loss tests.
3. Complete backup/import/recovery and exact XP compatibility, including maximum supported saves; a tested database restore and non-destructive rollback path.
4. Working school-approved login delivery/access on both real phones and laptops; clear limitations of shared-mode offline persistence understood by students/educators.
5. Five-tab/gameplay/offline/accessibility regressions; physical Safari/iOS and Android evidence rather than viewport emulation alone.
6. Owner-approved youth privacy/consent, provider/region/SMTP, retention/deletion/support process and budget; explicit release/deployment approval. Passing SQL tests alone is not release approval.

## 11. Minimal documentation changes and owner decisions

This PR adds **only this document**. Do not rewrite the historical brief, phase reports or current README as though sync already exists. Before implementation, make narrow updates:

* `AGENTS.md`: add a current-phase note that Phases 1–6 are complete and link this design; qualify constraint 2 to allow **optional authenticated Supabase sync only in approved Phase 7S work**. Keep cloud AI, default sharing, public profiles and teacher access prohibited. Clarify historical Phase 2 restrictions apply to that completed refactor. Record the explicit new account-workspace namespace exception while keeping the legacy key/recovery compatibility rule. Record the chosen SDK exception only after approval. Correct the historical “current app is an exact copy of V4” wording.
* `README.md`: initially link this as a proposal. When code is approved/implemented, separately document opt-in cloud behavior, public fork configuration, device modes and pending-sync limits. Preserve truthful current local-only instructions until then.
* Product brief: add a dated phase-status pointer noting that owner-approved account sync supersedes the earlier local-only scope for this purpose; preserve the V4/history distinction and product terminology.
* Add student-readable privacy, retention/deletion and fork/test setup docs with the implementing PRs. Record actual security/device evidence separately from requirements. No privacy promise should outrun deployed behavior.

Owner review decisions:

| Decision | Recommended approval |
| --- | --- |
| Progress model and conflicts | One versioned snapshot/account with preserved conflicts and explicit whole-version review; accept that automatic combination is deferred. |
| Login | Email codes first, conditional on school deliverability; choose one school OAuth provider later only if needed. Establish an address-change/graduation recovery policy. |
| Device privacy | Memory-only shared mode by default; durable private-device mode by deliberate opt-in. Durable offline use on a shared browser profile is not approved by this design. |
| Client dependency | Pinned locally served official Auth/client artifact, subject to successful zero-build packaging spike and explicit dependency/tooling approval. |
| Hosting/privacy | Canada Central proposed; select school/privacy reviewer, SMTP provider and responsible privacy contact. Decide eligible pilot jurisdictions/consent process. |
| Retention/deletion | Approve or revise three accepted snapshots, 90-day receipts, unresolved conflicts until reviewed, 30-day resolved conflicts, quotas and proposed inactivity process; approve a tested manual or self-service deletion workflow. |
| Spending | Pro from US$25/month plus email allowance; approve account/project ownership, staging budget, monitoring and payer. No purchase/provisioning authorized here. |
| Delivery | Approve scoped implementation PRs only after review. Student enablement, deployment and merge remain separate explicit approvals. |

**Beginner summary:** We would keep saving on the student's device and add a private online copy linked to their account. The laptop and phone compare version numbers before saving, so a stale device cannot silently replace newer progress; both versions are kept for review. Repeated uploads do not add XP twice. Email codes avoid another password, while strict database ownership rules and shared-computer controls protect account separation. Those safeguards still have to be built and tested. Plan on about **US$25–35/month** for a small pilot, plus any extra staging project, tax and exchange costs. The owner must approve the login/device choices, cloud/email location and privacy rules, SDK packaging and budget before implementation. Stop for review; no backend or student data was changed.
