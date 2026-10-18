# Phase 7S-A — Cross-Device Sync Architecture

Status: **proposal for owner review; cloud sync is not implemented or approved for student use.**

Prepared against `origin/main` at `9f535e1877e1d7d7ce6e13871f6256166707f3f2` (Phase 6, PR #6). Review date: October 18, 2026. Source and pricing links were checked during this audit; recheck them before implementation. This document contains illustrative SQL specifications, not an applied migration.

**Owner budget decision:** Supabase **Free, $0/month**, for development and initial testing. No Pro upgrade, paid staging, purchases, paid dependencies or assumed paid infrastructure. The initial paid-pilot recommendation is superseded. A later student pilot is conditional on the no-cost operational and security gates below; approving Free development does not approve student deployment.

### PR #7 review disposition

Addressing the [October 18 architecture review](https://github.com/Geng-Geng8/goal-quest/pull/7#pullrequestreview-5561436562) in this same draft:

| Finding | Resolution in this proposal |
| --- | --- |
| Classroom authentication bursts | Section 4 compares no-cost OAuth and free SMTP quotas, separates development-only default email, and requires a 30–60-person school-network sign-in/resend test before inviting a class. |
| Assigned versus shared laptops | Section 4 permits durable offline storage on an individually assigned laptop with a protected profile; genuinely shared profiles remain memory-only, with explicit loss-on-refresh/close wording. |
| Pages origin isolation | Section 8 makes an inventory and security review of all same-origin content, scripts and workers mandatory. An untrusted sibling Pages project blocks student use until an isolated HTTPS origin exists. |
| Duplicated validation | Section 5 timeboxes a feasibility spike and recommends a smaller strict server security/resource contract, with mandatory full JavaScript validation and quarantine before any remote adoption. The reduced server semantic guarantee requires explicit owner approval. |

Conflict protection still means **both snapshots are recoverable**, not that edits are automatically combined. A whole-version choice can exclude edits from the other version; that version remains recoverable within the stated retention policy.

## 1. Recommendation

Keep the existing vanilla JavaScript PWA and its local-first workflows. Add optional Supabase Auth and **one versioned progress record per authenticated student**, plus a small private submission/recovery table. Save locally first, then automatically upload a complete snapshot with the revision it was based on. The database accepts it only if that revision is still current. Otherwise it keeps the submitted snapshot as a conflict and leaves the current cloud record intact.

For an eventual no-cost school pilot, prefer **one school-approved Google or Microsoft OAuth provider**, using the school's existing accounts on both devices. This avoids per-login email delivery and OTP quotas. Email codes through a genuinely free SMTP plan are a conditional fallback, not an assumed service. Students use the **same Supabase user ID/account** on each device. Keep local-only use available and make uploading an existing record an explicit student choice. No framework or hosting migration is proposed.

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

### No-cost authentication: development versus student pilot

**Development:** use synthetic progress and a few explicitly authorized adult/developer test accounts. A Google/Microsoft provider can be exercised with authorized test identities after separate setup approval. Supabase's default email sender is only for occasional tests to existing project-team addresses; current documentation limits it to 2 messages/hour. Do not add students or test participants as Supabase project administrators to get mail delivered. Local Auth mail capture, if an already available local Supabase stack is used, tests code handling without real mail but proves nothing about school deliverability. No SMTP provider or database is configured by this documentation task.

**Eventual pilot recommendation:** choose the school's existing Google **or** Microsoft OAuth, with explicit school consent and the minimum identity scopes. These social providers are included in Supabase Free; do not substitute paid SAML/enterprise SSO. The recommendation assumes existing school identity accounts, not purchasing Workspace/365 licenses. School administrators may block consent or phone access, so there is no promise of zero-cost student readiness until an end-to-end test passes.

| Method | Cost and class-size suitability | Identity, privacy and recovery |
| --- | --- | --- |
| School Google OAuth | No incremental per-login email service for existing school accounts; preferable on a Google-managed cohort. Still test Auth/provider/IP throttles and consent. | Use basic identity scopes only, no Drive/Gmail access. School account recovery and eventual account closure are dependencies. [Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google). |
| School Microsoft OAuth | Same no-email advantage for an existing Microsoft-managed cohort. Correct tenant/consent setup may require school IT. | No Graph mail/calendar permissions. Verify supplied email and account identity behavior. [Microsoft setup](https://supabase.com/docs/guides/auth/social-login/auth-azure). |
| Email code + Resend Free | A continuing free transactional plan, currently 3,000 emails/month and 100/day; SMTP supported. Sixty initial codes plus sixty resends exceed its daily allowance. | Requires an existing domain/DNS control to verify a sender; a domain purchase/renewal would be a cost and is not authorized. Review processing region/retention, disable tracking, verify provider approval and actual throttles. [Pricing](https://resend.com/pricing), [SMTP](https://resend.com/features/smtp-service), [domain requirements](https://resend.com/docs/dashboard/domains/introduction). |
| Email code + SMTP2GO Free | Continuing free plan, currently 1,000 emails/month, 200/day; no credit card required. A 60-student class logging in on 20 school days needs 1,200 initial codes even without resends, exceeding the monthly limit. | Verify sender/domain and account approval; unverified senders have additional hourly restrictions. Provider signup/verification and existing-domain requirements must be checked before selection. [Pricing](https://www.smtp2go.com/pricing/), [limits](https://www.smtp2go.com/faq/), [sender limits](https://www.smtp2go.com/blog/smtp2go-questions-answered/). |

These are genuinely free published plans, not trials or a guarantee a particular account/domain will be accepted. Do not enable paid plans, overages, pay-as-you-go, dedicated IPs or paid domains. Provider terms and free allowances can change: recheck before selection. If school OAuth and free SMTP both fail the cohort's access/privacy/capacity tests, the student pilot is blocked at $0; continue synthetic development/local-only use rather than quietly buying email or disabling verification. No marketing consent or mailing-list enrollment is attached to authentication.

OAuth flow: **Create account / Sign in → school provider → return to app → verify session identity → choose device privacy mode → review existing progress if any**. Use the official client's PKCE flow; keep the verifier across the redirect in temporary sessionStorage for OAuth only, clear it after exchange, and keep shared-mode tokens/progress in memory. Do not put the whole session in sessionStorage. The school/provider's own logged-in session may persist independently: use an account chooser and explain that app logout is not school-account logout. If provider signup creates an Auth user on first login, require the privacy notice before initiating that flow, and never upload local data solely because a callback succeeded.

A full-page OAuth reauthentication redirect also destroys shared-mode memory. Before initiating it with pending work, require a private export or a successful save through a still-valid session, or let the student cancel/stay on the locked page. Do not promise that an inactivity lock or later login preserves memory through navigation. If a popup-based reauthentication is later chosen to keep the parent page alive, test it on managed browsers/installed phones and never silently fall back to a destructive redirect. Existing durable private-device queues remain intact through redirects.

If email codes are chosen instead: separate explicit creation from ordinary sign-in (`shouldCreateUser:false` on sign-in), use a code template, 10-minute expiry, verified sender domain/SPF/DKIM/DMARC, disabled tracking, neutral responses and no token/code logging. Successful send is not yet authentication. [Email code flow](https://supabase.com/docs/guides/auth/auth-email-passwordless). Disable unused password/phone/anonymous-account/providers, retain server-side verification, and use school/provider age and account rules. No SMS/phone collection is required.

Never merge accounts by typed email, similar names or backup contents. If a second provider is later added, test verified-identity linking/authenticated linking explicitly; both existing workspaces remain recoverable. OAuth account recovery belongs to the provider/school, not an automatic email-code fallback. Before graduation or account closure, offer private export; linking a personal identity or changing login email is a separate verified ownership flow, not staff reassignment based on a student's name. For a provider-only pilot, do not promise Supabase email-change/security notices without an approved SMTP delivery path. Operational privacy/deletion contact remains available without marketing.

### Classroom authentication rollout gate (30–60 students)

Custom SMTP does not remove Supabase Auth limits: its documented initial project email limit is **30 messages/hour**, adjustable in Auth configuration. Default sender restrictions are separate. Verify the actual project configuration, provider hourly/daily/monthly limits, per-recipient resend interval, code-verification limits and per-IP Auth limits before invitations. A classroom behind one school NAT can hit an IP limit even when email quota remains: current documented defaults include 30 signup/sign-in-path requests and 30 verification requests per five minutes/IP, and 150 token exchanges per five minutes/IP with a burst of 30. Not every provider flow uses the same endpoint. Record the actual tested OAuth/PKCE route, not just a nominal quota. [SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp), [Auth limits](https://supabase.com/docs/guides/auth/rate-limits).

After separate test authorization, run a staged **30-person then 60-person sign-in within ten minutes**, from the intended school network, using authorized test identities and synthetic progress. Test laptop/phone sign-in, expired/wrong codes (if enabled), a legitimate resend subset after the configured cooldown, repeated button taps, provider consent, school spam filtering and retry after throttling. Do not create fake identities or mass-send mail without provider/school authorization; if 60 test identities are unavailable, record the gap and keep the cohort gate closed. Capture timings and aggregate error/429/delivery counts without emails/tokens in public logs.

For a 60-person email test with 20% resends, allow at least **72 messages in the test hour** plus other security mail, within the chosen free provider limits. A one-resend-each stress case needs **120**, so Resend's current free daily cap cannot cover it in one day. Raise the project's configured email limit only within verified no-cost provider capacity and reviewed abuse controls; do not disable confirmation or remove cooldowns to pass. OAuth bypasses OTP email volume, but its consent, shared-NAT throttles, callback and school phone-access paths must pass the same cohort login exercise. Only testing a single developer's inbox is insufficient.

Handle 429/Retry-After with calm wait/retry guidance and no duplicate auto-send loop. A configured cooldown is not proof of server enforcement. Sustained cohort usage and recovery messages must fit the monthly budget as well as the first class; otherwise choose OAuth or reduce an explicitly approved pilot cohort. A CAPTCHA or extra security service would need separate privacy/cost review; none is assumed.

### Sessions, individually assigned laptops and shared computers

An account namespace prevents accidental app mixing; it does **not** make readable browser files confidential from another person using the same browser profile. Shared mode must therefore avoid persisting student data there.

* Default: **Shared computer — don't keep my progress here**. Tokens, downloaded progress and offline edits exist in memory only. Explain before editing: **“Offline changes on a shared computer will be lost if you refresh or close. Sync online or download a private backup first.”** Logout/close/refresh requires login again. Browser unload warnings are not reliable and cannot guarantee a warning before loss. Do not persist tokens/progress in localStorage, sessionStorage, IndexedDB or the worker cache; only the temporary OAuth PKCE verifier may use sessionStorage as described above. Add an app-level inactivity lock (proposed 15 minutes, subject to school review), not a paid Supabase session-timeout feature. Preserve pending memory work behind the lock until verified as the same user or explicitly discarded/exported. Reauthentication while offline is unavailable.
* Opt-in: **Only I use this device/profile — keep progress offline here**. Applies to a personal phone **or an individually assigned school laptop with a separate protected OS/browser profile**, school approval to retain data, and no routine profile wipe/shared sign-in. Persist its account workspace/session with a project/account-specific adapter. Device ownership by a school does not itself make the profile shared. Confirm these conditions instead of inferring privacy from “school laptop”; switching browser profiles and managed cleanup can still remove data. Include refresh/close/reopen offline in assigned-laptop acceptance tests.
* A lab/kiosk, library PC, shared browser login or borrowed unlocked profile is **truly shared** and stays in shared mode. It cannot meet durable offline recovery after close/refresh under this design. If that is a school requirement, obtain individual protected profiles or a separately approved mechanism before deployment; a local PIN or account namespace does not protect disk data. Never promote a shared profile to durable mode automatically to make an offline test pass.
* On private-profile offline reload, clearly identify whose saved workspace is being opened. Anyone with that unlocked profile, and potentially school device administrators, may access it. Durable device mode relies on OS/browser-profile privacy; it is not end-to-end encryption or protection from device management.
* Always show the active account (a restrained email label in account settings) and device mode. Never auto-select a cloud owner from the legacy save. Signing into B must never attach A's pending work, recovery, forms or timer to B.
* On logout/account switch: stop sync and timer callbacks, increment a session/workspace generation, abort requests, close private dialogs, clear rendered private content and in-memory references, and tell other app tabs to lock. Every callback checks the captured user ID **and** generation before updating any state. Late A replies are discarded after switching to B.
* Default logout removes that account's device workspace, recovery, queue and auth tokens after a successful cloud save. With unsynced work, offer **sync and sign out**, **download then remove from this device**, or **cancel**. Offline sign-out clears local credentials immediately but cannot promise server revocation until online. Never silently delete pending edits. Downloads are outside the app's control; warn shared-device users that files can remain in Downloads.

Supabase access JWTs can survive logout/deletion until expiry. Require a server check that their `session_id` still exists for this user on **all progress reads and writes**, in addition to RLS ownership; configure a short, supported JWT lifetime (proposed 15 minutes). Other devices should remain signed in for normal device-local logout; provide a separate clearly labelled all-devices action for loss/theft. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [account deletion caveats](https://supabase.com/docs/guides/auth/managing-user-data).

## 5. Database and exact isolation policy specification

### Two app tables

Store canonical compact JSON as **text**, so a supported record at exactly 2 MiB is not rejected because PostgreSQL JSONB pretty serialization added spaces. Parse its bounded envelope server-side, treating all student strings as inert data; never render/execute them as HTML. The write request transports this text as a JSON string, so escaped HTTP size can exceed 2 MiB: measure gateway/request limits with worst-case fixtures. A transport failure must leave the local state and queue intact. These table checks are only part of the server contract; full app semantic validation is mandatory on the client before upload and adoption, as specified below.

### Validation feasibility and maintainable boundary

**Supersedes the initial requirement to reproduce the complete V8 validator in SQL.** `js/data-safety.js` already contains migrations, date/ID rules, goal-status relationships, lazy rewards, timer invariants, unknown-field scanning and backup size fallbacks. A second handwritten implementation creates continuing parity work every time the JavaScript schema changes; matching `JSON.parse`, JavaScript number behavior and Unicode limits is especially easy to get wrong. Neither using the official Supabase client nor PostgreSQL JSON syntax checks provides that parity automatically.

Timebox the first part of **7S-B1 to one developer day (maximum eight hours)** for a disposable validation feasibility spike, using synthetic fixtures only. Compare a bounded SQL candidate against V4–V8 migration outputs, unknown fields, invalid dates/IDs/achievements/rewards, prototype keys, unsafe numbers and maximum-byte/depth/multibyte/Unicode-escape cases. Record runtime on a small database, lines/rules duplicated and how one schema change updates both implementations. No schema is applied in this architecture task. Do not spend subsequent PRs chasing parity without a decision.

**Recommended baseline after the spike:** treat the snapshot as private, versioned user data, and enforce a deliberately smaller server contract. This needs explicit owner approval because a cloud-accepted snapshot is then **not certified as an app-valid backup**. Full SQL parity is optional only if the spike demonstrates a small, maintainable result; it is not the prerequisite for secure account isolation. An Edge Function duplicating validation, a paid schema service or a framework rewrite is not the fallback.

| Boundary | Required checks |
| --- | --- |
| Database/RPC, always authoritative | Verified active session, owner from JWT only, RLS and restricted grants, protocol/data version, safe integer revision, UUID request, exact-byte server hash, transaction/CAS/deduplication, retention and request/byte quotas. These never depend on browser validation. |
| Bounded server snapshot envelope | Nonempty UTF-8 text at most 2,097,152 bytes; parseable JSON object; numeric `version:8`; `goals` array at most 1,000 entries. Reject malformed/wrong top-level types, unsupported protocol, and excessive resource use before head mutation. Use database statement timeouts and bounded requests. No arbitrary SQL/dynamic identifier from a payload. |
| Existing JavaScript validator | Full `parseSavedState`/`migrateState` safety and semantic rules, followed by `serializeBackup` exportability, before any local upload or cloud adoption/render/gameplay. Keep this one canonical implementation for V4–V8 compatibility. |

The small server envelope check must distinguish numeric `8` from string `"8"`; the illustrative table text-version check is insufficient on its own. Prefer PostgreSQL `json` for bounded envelope inspection while preserving the source text, avoiding JSONB normalization of arbitrary unknown values. Prove JavaScript-compatible Unicode escapes, number literals and maximum-size inputs round-trip; a parser mismatch is a compatibility blocker, not permission to drop an unknown field. The server may accept an owner's payload with a semantically invalid goal, unsafe JavaScript number or reserved nested key: those cases are **client-rejected on download**, not falsely reported as SQL-validated. This does not allow access to anyone else's rows. Server-side byte/shape/quota/timeout tests still have to demonstrate that hostile own-account data cannot exhaust shared resources; a Free project provides no unlimited abuse protection.

For every remote head, conflict, recovery or operator restore: parse/validate **before** rendering or replacing local work; treat remote content exactly like an untrusted import. If invalid, preserve the last valid local state/base and recovery, quarantine raw remote text plus its observed revision, pause automatic adoption/upload and show “This cloud version couldn't be opened. Your saved work is unchanged.” Offer a labelled **raw recovery file**, not a claimed restorable full backup, and a validated local backup. A repair/replacement requires explicit preview and CAS against the observed bad revision. Never turn validation failure into an empty state, mark that revision adopted, or auto-overwrite it. Retained cloud submissions can also be invalid; history retention is not a guarantee of three valid backups. Recovery drills must include this limitation.

Maintain a test table documenting **server reject / server accept but client quarantine / valid round trip** for each adversarial fixture. Invalid remote states must leave valid local/recovery bytes unchanged and never execute content or award XP. B1's PR report must identify the chosen validation boundary and any drift from this recommendation; owner approval of this architecture can approve the reduced semantic boundary explicitly. That is a recorded tradeoff, not a silent weakening of data-safety claims.

### Proposed tables

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
  check (json_typeof(state_text::json) = 'object'),
  check ((state_text::json ->> 'version') is not distinct from '8')
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
  check (state_text is null or json_typeof(state_text::json) = 'object'),
  check (state_text is null or (state_text::json ->> 'version') is not distinct from '8')
);
create index progress_submissions_owner_time
  on public.progress_submissions (user_id, created_at desc);
```

`state_text` contains the complete compatibility snapshot described above. `revision` is a server-controlled monotonic concurrency token, separate from state `version`, backup version and sync protocol version. Base revision 0 means “create only if no cloud record exists.” The second table holds retry receipts and recoverable accepted/conflicting snapshots. A compacted receipt may retain the hash/outcome without its older accepted payload. Never compact an unresolved conflict.

No separate profiles/rosters or redundant email columns. `auth.users` contains authentication identity; progress ownership is the immutable UUID. Local goal/task IDs are not replaced with database IDs. Do not send a stable hardware identifier; request UUIDs are enough.

### Privilege boundary and RLS

**B1 live-test revision, prepared but not applied:** the managed Auth schema cannot be delegated by ordinary `postgres` on the audited Free project. The grant-dependent helper/grant/policy snippets below are historical specifications superseded for the proposed B1 implementation by the [trusted-session helper design and tests](./PHASE_7S_B1_TRUSTED_SESSION_HELPER.md). Only a no-argument UUID/session lookup is `postgres`-owned, private and definer; it never accesses progress. The progress writer stays non-owner/NOBYPASSRLS, and all four ownership policies use the same active identity result. Existing operator prerequisites were demonstrated read-only; real SQL/HTTP security tests remain required after explicit migration approval. No changes have been applied by this revision.

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

The writer has no DELETE grant despite its ownership policy covering all commands. Retention is a separate restricted maintenance operation. Verify actual table ownership, role attributes/memberships, `auth.sessions` column access and function ownership in authorized local/Free test environments. Grant any temporary CREATE permission required to assign function ownership only inside the migration transaction, then revoke it. Do not leave the writer able to create/replace functions or tables. The session helper returns only a boolean for the current JWT; it cannot list users/sessions. Missing/malformed session claims fail closed.

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
3. For a new request, enforce per-account conflict/byte quotas and the chosen server envelope/resource contract above. Reject violations before modifying the head or recovery. Under the recommended smaller contract, complete V8 semantics/exportability are client checks; do not claim a server receipt proves them. Preserve the original text and unknown data without interpreting it as application instructions.
4. For no head and base 0, atomically create revision 1 and its accepted submission. Two first-device migrations serialize: exactly one creates the head. The other becomes a preserved conflict against revision 1.
5. For an existing head at the supplied base, insert the accepted submission and replace the head at `revision + 1`, assigning the new request ID and server time. Include the revision predicate in the update as an extra guard. An identical new snapshot may advance the revision but never adds XP. Client comparison avoids redundant submissions; keep server semantics uniform rather than introducing a second no-change receipt protocol.
6. If the head has advanced, store the submitted candidate with `outcome:'conflict'`, its base and observed current revision. Return conflict ID and head revision, never overwrite the head. A future/nonexistent base is an invalid request. A conflict is a **committed result**, not an exception that rolls back its preserved snapshot.
7. Receipt, snapshot and head changes either all commit or all roll back. Timeouts after commit are retried with the same UUID/text/base. Permission, validation or quota failure must not acknowledge or remove local pending work.

Implement request deduplication before mutating anything and recheck session validity at the authorization boundary. Return bigints safely within the specified JS-safe range. The client must fetch the current head after a duplicate receipt; an old success receipt does not prove that its snapshot is still current.

Free-tier retention proposal: keep the current head, the most recent **three accepted submission payloads** per account, retry metadata for **30 days**, unresolved conflicts until explicit review, and resolved-conflict payloads for **7 days**. Compaction clears older accepted payloads but keeps their receipt hashes during the retry window. If an old receipt has expired, its old base is stale and the retry becomes a conflict; it must never replay an XP delta. Cap unresolved conflicts at 10/account initially and total retained payloads at **16 MiB/account**; refuse additional submissions visibly while retaining local candidates if the limit would be exceeded. A maximum-size snapshot can hit the byte cap before the count cap. Do not evict unresolved work to make room. Run compaction within the owner's serialized write transaction or an explicit no-cost operator maintenance step; no paid scheduler is assumed. Project-wide headroom and write-pause procedures in section 9 take precedence over per-account allowances. Retention/quota values require owner approval and measured sizing.

## 6. Local-first synchronization protocol

### Local durability and ownership

Retain `h4_goal_quest_v4` and its recovery key for existing/local-only use. Account workspaces use a **new IndexedDB database** keyed by Supabase project identity plus user UUID; do not repurpose the global legacy key as whichever account is signed in. IndexedDB transactions atomically store working state, recovery, acknowledged base snapshot/revision, current local sequence, immutable in-flight request and newer pending snapshot. Storage failure keeps work in memory/exportable and stops uploads of uncommitted local work. Test Safari IndexedDB failure/private mode/quota cases.

IndexedDB is justified here because localStorage cannot atomically commit a state record and separate outbox metadata, nor safely serialize competing tabs. Keep native browser APIs and a small explicit adapter; no general sync library. Local-only mode can keep the existing store behavior until a separately scoped improvement. `app.js` remains the composition root and feature modules still receive a store; introduce focused `auth.js`, `account-store.js`, `sync.js` and optional `sync-controls.js` rather than rewriting gameplay.

Each durable mutation reads the workspace generation/sequence inside a read-write transaction and commits only if it still matches the view being edited. A stale tab preserves its candidate and asks for reload/review, rather than retrying its full stale state. BroadcastChannel/storage notifications can announce changes, but are not the lock. Reconcile open forms, drafts and paused timers before replacing their store. Test two tabs without Web Locks or BroadcastChannel as well as with them.

### Normal save/reconnect

1. Existing gameplay runs once against the local working state. Validate/export-check and commit working state plus pending progress snapshot locally. Only after successful transaction completion say **Saved on this device**.
2. Compare the progress projection with the last queued/acknowledged projection. Navigation, timer ticks and UI acknowledgement do not enqueue cloud writes. Debounce real edits (proposed 2 seconds, maximum 10 seconds while active) and flush after explicit saves/online/visibility return. Local durability is immediate; network debounce never postpones the local save.
3. With a validated active session and connectivity, fetch the head. Always fully validate downloaded data, even if this client's work is dirty; invalid remote data follows the quarantine path in section 5 and requires explicit repair. If local work is clean, persist a local recovery/base transaction before adopting it. If dirty and the remote snapshot is valid, never replace it: send its candidate with its **original base revision**, even if a newer head was just discovered.
4. Persist a fresh request UUID and immutable payload/base before sending. One in-flight request per workspace across tabs. Later edits update a distinct pending snapshot; never mutate the in-flight request or call gameplay again to reconstruct it.
5. On acknowledged acceptance, persist the new base and receipt. If the local sequence still matches the sent sequence, mark it clean. If later local edits exist, keep that newer working state and send its full snapshot next, based on the accepted revision. If another device committed meanwhile, the next attempt conflicts safely.
6. A failed response leaves the exact in-flight request pending. Retry network/429/5xx failures with exponential backoff and jitter (proposed 1–60 seconds, honor Retry-After). A 401 pauses for renewed sign-in as the **same UUID**. Permission/validation/version/quota errors stop automatic retries and offer safe help/export. Use fetch success, not `navigator.onLine`, as proof the service is reachable.
7. Check on startup, sign-in, reconnect and foreground return, plus a modest visible-tab poll (**60 seconds** initially, selecting only revision/server time and minimal unresolved-conflict metadata; download full state only when changed or needed for review). Query responses and write receipts must not echo full payloads unnecessarily. Coordinate one poller per durable workspace across tabs where feasible; always stop hidden/signed-out polling and back off during errors/project pause. New remote work is adopted only if locally clean and no private form contains unsaved input; otherwise preserve it and offer review. Do not force reloads or discard open input. Measure egress before changing intervals; correctness relies on revisions, not fast polling.

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
| Browser compromise / GitHub Pages | Use escaped/text rendering and full validation before displaying remote/imported fields. No student-controlled HTML, external executable scripts/fonts or evidence-URL auto-fetching. No goals/tokens in URLs, console logs, analytics, crash reports or worker caches. The mandatory origin/security gate below applies before any minors' data is used. RLS cannot protect a student from same-origin code using that student's stolen session. |
| Credentials and supply chain | Browser receives only project URL + publishable key; that key is public and does not authorize access without RLS. Never service-role/secret keys, DB passwords, provider secrets or SMTP credentials in GitHub/public assets. Store privileged secrets only in approved server/admin environments. Prefer the official Auth client to handwritten refresh/token handling; see the dependency decision below. |
| Retention and server backup | Propose no silent deletion of active progress; 12 months of inactivity before a notice/grace process (30 days) and deletion, subject to approved policy. OAuth-only deployments must define a working notice/contact route rather than assume free security email delivery. Cloud conflict/receipt retention is above. Free has no included automatic database backups; operator exports/restore limits are in section 9. Approved deletion must also govern retained operator exports, and any restored data must reapply deletions before access is reopened. Keep only a minimal private suppression record outside restored datasets, with approved retention/access. Do not promise provider-wide erasure beyond verified policy. |
| Student deletion request | Offer full export then fresh-account verification and confirmed deletion. A narrowly scoped trusted admin operation verifies identity, revokes sessions and hard-deletes that Auth user; FK cascades remove both app tables. No service-role key in the browser. A pilot can use a documented privacy-contact workflow with an administrator, if timely and tested; self-service Edge Function may follow in its own PR. Request fresh verification before deletion; a stale ordinary bearer token alone is insufficient. Test session checks deny old tokens and prevent stale queues resurrecting deleted records. Explain that other offline devices/backups/downloads cannot be remotely erased; clear them when next opened if deletion is detected. |
| Outages / data loss | Local transactions, cloud receipts, preserved conflicts and private JSON exports are separate safeguards. They do not stop browser eviction or hardware loss before sync. Monitor aggregate errors/quotas without recording goal content; provide a support/incident process and a database restore drill using synthetic data. Never request student backups in public issues. |

### Mandatory GitHub Pages origin and browser-security gate

`https://geng-geng8.github.io/goal-quest/` and `https://geng-geng8.github.io/ANOTHER-PROJECT/` share the same scheme/host/port **origin** if deployed there. Different repository paths, account-prefixed keys, IndexedDB names and service-worker scopes do not isolate their browser storage. Same-origin JavaScript can read localStorage/IndexedDB or misuse a saved session regardless of the path prefix. Do not claim `sessionStorage`/memory mode eliminates an untrusted-origin risk: it reduces persistence but cannot make hostile scripts executing in the app safe. [MDN same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy), [GitHub Pages hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Before **any minors' data**, inventory the actual intended HTTPS origin: all Pages repositories/user pages/custom-domain content on it, deploy permissions, collaborators, third-party scripts, legacy pages and existing workers (including root-scope workers). Review whether every publisher/code path is equally trusted with students' sessions. Record the origin and reviewer sign-off; the example URL here is not proof Pages is deployed or safe. Use synthetic test contexts to demonstrate same-origin storage visibility, the selected worker scope and absence of private responses/tokens in caches/history/logs. Repeat when another same-origin app or publisher is added.

If any sibling content is untrusted, unknown or cannot be controlled, **student use is blocked until a dedicated isolated HTTPS origin is approved**. Keep GitHub Pages: a dedicated Pages account/organization hostname with only trusted H4 content, or an already-owned school/H4 custom hostname pointing to Pages, can avoid an incremental hosting fee. Account/domain control, HTTPS and all content on the new host still require review. No domain registration, paid proxy or migration away from Pages is authorized. If no appropriate no-cost origin is available, continue synthetic development and local-only evaluation; do not downgrade this gate to meet the $0 budget. The canonical open-source repository can remain `Geng-Geng8/goal-quest`; publishing ownership/configuration is a separate owner decision.

For the approved origin, B1 must document and test a static-compatible CSP: scripts limited to local reviewed assets, no runtime CDN or `unsafe-eval`, exact Supabase `connect-src`, no plugins via `object-src`, and compatible image/style/base/form restrictions. Re-audit inline styles/SVGs and OAuth redirect behavior before choosing the exact policy. A Pages-deliverable meta CSP has limits (including no effective `frame-ancestors` directive) and is not equivalent to configurable security headers. Review framing/clickjacking and sensitive account controls explicitly; unresolved findings block release. CSP, CORS, RLS and redirect allowlists do not create isolation from malicious sibling same-origin content. [CSP behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy).

Also test downloaded student text for XSS, reject executable content, inspect external links and use appropriate opener/referrer protections. Remove callback code/error parameters after the official SDK processes them, before private rendering/links; no session tokens in URLs. Use PKCE and exact return URLs, never an open redirect. Review repo/deploy access and privileged operator MFA. These are planned checks, not assertions that the current app has already passed a browser-security audit.

### Official client packaging: no paid or remote runtime dependency

Recommend the free/open-source **official `@supabase/supabase-js` client**, pinned and **served locally** with the app, with license, reviewed transitive code, version/integrity record and repeatable update procedure checked in. Keep vanilla JavaScript and GitHub Pages. No React, paid package, runtime CDN or hosted script loader. Prefer a browser-ready official distribution; a locally vendored UMD browser file with a tiny app adapter is acceptable if native ESM would require extra packaging machinery. Do not represent a CDN reference or bare npm specifier as an offline-ready browser module. [Official JavaScript installation guidance](https://supabase.com/docs/reference/javascript/installing).

B1 first verifies the pinned browser artifact, its provenance/dependency graph and size, Auth PKCE/refresh/storage-adapter behavior and complete offline shell availability. Check it from the official package/release rather than downloading an unversioned third-party build. Every dependency update is reviewed, regression-tested and included in the shell hash table; existing student clients must not load mixed versions. The resulting app must run directly from the existing static server with no install/build step. If no maintained ready-made artifact works without local bundle-generation tooling, report the exact minimal **free development-only** tooling proposal and obtain approval before adding it; do not quietly introduce a bundler. Do not hand-write Auth refresh logic to avoid the official client. Owner approval is still needed for this narrow runtime-library exception to `AGENTS.md`; no dependency is added in this PR.

### Forking remains straightforward

Future setup documentation must make local-only the default when no cloud config exists. A fork should:

1. Run the existing files unchanged on a static server with no account configuration.
2. Independently approve its privacy/age/retention/region policy and create **its own** Supabase project; never reuse H4's public project URL/key just because the key is publishable.
3. Apply the reviewed schema/functions/RLS and synthetic two-account isolation tests to that project. Configure Auth/SMTP and only approved login providers. Privileged config stays in that project's dashboard/server secrets.
4. Copy a future `sync-config.example.js` to a local public config module containing only its project URL, publishable key and feature flag. Treat config as public and tie IndexedDB/token namespaces to the project identity. Changing projects must not replay queued work into the new project.
5. If OAuth is enabled, register the provider's callback at the fork's Supabase project and the exact app return URL such as `https://OWNER.github.io/REPO/`. Keep relative frontend paths; never allow arbitrary production redirect wildcards or return URLs. Code-based login avoids a link callback dependency. Remove auth callback parameters before private rendering and test installed contexts. [Redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
6. Apply the same-origin inventory/release gate to the fork's actual Pages hostname, review CSP/connect allowlists, local SDK provenance and offline asset hashes, and publish only after that fork's security/device gates pass. Development test config must never connect CI or a PR preview to real student accounts. Free-only forks use the export/restore and quota procedures below; no paid infrastructure is required just to fork/run. Export/import remains the portable path between projects; it does not transfer identities or silently associate accounts.

## 9. Confirmed $0 development design and Free-tier operations

**Approved service budget: $0/month.** Confirmed against published Free allowances, not a live-project/configuration audit: **500 MB database, 5 GB monthly uncached egress, up to two active Free projects, project inactivity pause after one week, social OAuth/custom SMTP support, and no included automatic database backups**. Do not count cached egress as extra private Data API capacity. [Supabase Free pricing](https://supabase.com/pricing).

| Environment/component | $0 plan and boundary |
| --- | --- |
| App / development | Existing vanilla app, static server, GitHub Pages and Node tests. Local-only runs with no cloud project/client config. Existing computer/tool availability is assumed; no paid dependency is needed. |
| Hosted synthetic testing | One Free project, **only after separate provisioning approval**, authorized developer accounts and invented student records. Keep usage small; do not inspect/change an existing live project to “prepare” it. |
| Staging / CI | Local mocks/fixtures first; optional local Supabase if free tooling is already approved/available. A second Free project may be used only if available within the owner's organization/account allowance and separately authorized. No paid branching, always-on paid staging or unlimited free project assumption. External/PR CI does not receive live credentials. |
| Later student pilot | Free-only, small cohort sized from measured database/egress and all release gates. Existing school OAuth preferred; SMTP only if an approved free plan meets actual volume. This is a separate release decision, not part of development approval. |
| Cost triggers, **not approved** | Pro, extra paid projects/compute, paid SMTP/overages, SAML SSO, paid SDK/tooling, SMS, paid backups/PITR, log drains, paid storage/monitoring, dedicated IP/custom-domain add-ons and new domain purchases/renewals. Existing school licenses/owned domains are prerequisites where used, not new free entitlements. |

Do not add a paid subscription or enable automatic overages/upgrades. On a Free quota limit, expect possible rejection/read-only behavior or service interruption; preserve queued local work and explain the pause. Never claim unlimited reliable availability at $0, “automatically upgrade if needed,” or managed spend-cap features not included in this plan. Provider signup restrictions or an unavailable free slot can block hosted testing; local-only synthetic checks can continue.

### Capacity and pause controls

Start with roughly **5–10 authorized developer test accounts**; boundary/load tests use controlled synthetic records and a separate resettable local/test context. A future first student cohort is proposed at **30**, with a 60-person login capacity exercise before increasing it. User count is not the only limit: a supported maximum-size student record is much larger than an average one.

Illustrative raw-data calculations (not a quota guarantee):

* 30 accounts × 4 copies (head + 3 accepted submission payloads) × 50 KiB ≈ **5.9 MiB**; 60 ≈ **11.7 MiB**. Auth tables, indexes, receipt metadata, conflicts, TOAST/dead tuples and database overhead are additional.
* At 2 MiB each, 30 × 4 ≈ **240 MiB**, before any conflicts/overhead; 60 × 4 ≈ **480 MiB**, so that worst-case cohort does **not** fit safely in 500 MB. Preserve support for individual maximum-size backups; restrict cohort/growth or pause cloud writes rather than reducing the file limit or dropping fields.
* 30 accounts × 10 full 50 KiB downloads/day × 30 days ≈ **0.43 GiB/month**; 60 ≈ **0.86 GiB** before protocol/revision polls/recovery downloads. At 2 MiB, the same 30-account pattern is **17.6 GiB**, beyond Free. Full-snapshot sync is affordable only when measured record size/change frequency fit.
* Plan operator exports into the same egress budget: a 10 MB logical dataset exported daily is about **0.3 GB/month**; 100 MB daily is about **3 GB/month**. Do not assume direct database downloads/exports are unmetered. Measure billed traffic; avoid repeatedly exporting unchanged large history.

Operator checks Dashboard aggregate database/egress usage after each test session and each pilot day. Proposed early warnings: **250 MB database or 2.5 GB month-to-date egress**, plus projected month-end use; stop cohort growth at 350 MB and pause new cloud writes before 400 MB or when forecast egress exceeds 4 GB. Use measured total size, not just summed state text. A reviewed operator can revoke RPC execute permission to pause writes while keeping reads/RLS intact; expose that failure as pending, not saved. A nearing egress limit also requires backing off routine reads; keep user-requested exports/recovery available as capacity permits. Reaching a threshold triggers review/reduction of new admissions and optional reads, never auto-upgrade, deletion of unresolved conflicts or destruction of the local outbox. These are conservative app operating limits, not Supabase billing thresholds.

Keep the short retention/quota policy in section 5 and metadata-only polling; do not write on every render/navigation. Avoid Realtime, attachments, server copy of device logs and unbounded revision history. An accepted request's hash/receipt is cheap compared with repeatedly retaining its full text, but still needs compaction. A Free project can pause after inactivity, especially during school breaks. Do not create keep-alive traffic to evade the policy. An operator checks/resumes it via the dashboard before scheduled testing, confirms Auth/read/write/RLS and allows resume time; the UI retains local pending edits and backs off until service returns. Free is unsuitable for a promise of uninterrupted cloud availability.

### Manual exports and recovery on Free

Supabase recommends regular off-site exports for Free projects; no automatic database backup or point-in-time recovery is included. The following is an **operator-run recovery procedure with a loss window**, not equivalent to managed automatic backups. [Free backup guidance](https://supabase.com/docs/guides/platform/backups).

1. **Record schema/config safely.** Keep reviewed app migrations, function definitions/RLS/grants, schema/protocol versions and a non-secret Auth/provider configuration checklist in Git. Never progress dumps, email mappings, DB passwords, service keys, OAuth/SMTP secrets or students' exports. Use an operator workstation with existing encrypted private storage; no new paid backup service is assumed.
2. **Export a consistent app dataset.** After each synthetic test session, before a schema/config change, and daily while eventual pilot cloud writes are enabled, export both app tables in one repeatable-read transaction/snapshot using a version-checked `pg_dump` or the Supabase CLI. Export all heads and submission metadata/payloads, including unresolved conflicts; a CSV of just `student_progress` is incomplete. Produce a manifest with UTC time, source project ID, migration/commit, row counts, revision maxima and file SHA-256. Verify completion, checksums and restore readability before recording success. B1 documents actual tool versions/flags using their `--help`; no dump commands are executed here.
3. **Protect and limit the export.** Encrypt at rest, restrict access to the named operator, keep a second copy on existing approved encrypted media/location, and retain a proposed seven successful daily exports plus a pre-change copy for at most 30 days. Delete expired copies and apply approved student deletion policy; do not publish them as GitHub artifacts, use a public bucket or paste them into issues. If no suitable existing private storage exists, hosted student use is blocked rather than silently purchasing or leaving plain dumps on shared computers. Track the last successful export; missed pilot-day exports block new admissions and require an operator recovery decision.
4. **Know what app exports do not restore.** App rows alone do not restore Auth identities, user UUIDs, OAuth setup, provider secrets, signing/encryption keys, sessions or the Supabase project. For same-project row recovery, preserve existing Auth users and verify FK/owner mappings. For whole-project disaster recovery, use the current documented platform logical backup/restore procedure and **prove** whether the selected export includes required Auth data, custom roles/schema and encryption material. Such a separate identity backup is highly sensitive and needs explicitly approved operator handling. Do not assume CLI defaults include everything or promise transparent account recovery. [Platform restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
5. **Rehearse before student use.** Restore a synthetic export into an authorized local instance or available second Free project, never overwrite the only live copy for practice. Recreate reviewed role/function/RLS definitions, load data with error-on-failure/transactional safeguards, verify counts/checksums and run full incoming JavaScript validation plus A/B isolation tests. Do not expose the restored app until all checks pass. Invalid snapshots stay quarantined, not rendered as valid progress. Record duration and any missing identity/config dependencies. If a free restore target is unavailable, the rehearsal remains incomplete and blocks a student pilot.
6. **Recover deliberately.** Pause cloud writes, take a preservation export if possible, restore only after owner/operator approval, reapply deletion suppression, revoke restored/stale sessions as appropriate and require sign-in again. A restored revision counter can collide with an old device's acknowledged revision: **invalidate protocol 1 writes and increment the sync protocol/restore epoch before reopening writes**, update the SQL version constraints/RPC/client together in a reviewed recovery release, and require every old workspace to re-fetch/review its preserved local candidate. Never accept its old base just because a numeric revision matches again. Re-run security/recovery tests before reopening. If identities cannot be restored, create replacement accounts only through verified sign-in; the student explicitly imports a private backup or an operator makes a separately verified mapping. Never reassign by a typed email/name alone.

For an eventual pilot, proposed operator recovery targets are **up to 24 hours of cloud work lost** between successful daily exports and recovery by the **next staffed school day**, subject to measured restore drills; these are human-process goals, not an SLA. Daily export staffing must cover weekends/breaks if cloud writes remain enabled; otherwise explicitly approve a longer loss window or planned cloud-write pause before that period. Missed exports can make loss exceed the target. Work after the last export may survive on private devices/JSON backups, but cannot be promised. Student-compatible offline JSON export/import remains an independent safeguard and is encouraged after important work. No paid scheduler, unattended credential-bearing CI job, managed backup, paid staging or automatic restore is assumed. If these loss/availability limits are unacceptable, keep student cloud rollout blocked pending a new owner decision; do not spend money.

## 10. Reviewable implementation roadmap

Each PR starts from current main, retains the immutable V4 fixture, uses synthetic data and remains gated off for students. Backend provisioning/migrations and any deployment require separate explicit approval after this architecture review. Run current Node regressions for each affected area and all browser regressions before release; do not rewrite tests to normalize data loss.

| PR | Scope | Required acceptance evidence |
| --- | --- | --- |
| 7S-B1: Authentication and secure database foundation | **First implementation PR.** Official locally served client spike; eight-hour SQL-validation feasibility decision; local-only default/public config example; authorized test Auth with one selected provider; two tables, small server contract, restricted CAS/receipt RPC, RLS/session checks; origin/CSP review and manual export/restore runbook. Synthetic tests on local/Free only, subject to separate provisioning approval. No adoption or app autosync. | Two authorized test users plus anonymous/forged/revoked JWT API tests pass the isolation matrix; direct table writes denied, function/role grants inspected, server-reject/client-quarantine fixture expectations recorded. Static serving/offline SDK demonstrated; no secrets/CDN/paid services; actual Free usage/config/limits recorded after setup. Synthetic app-table export/restore and protocol-reset test demonstrated on a no-cost target. |
| 7S-B2: Private student workspaces and local data migration | Native IndexedDB adapter, durable mode for personal/individually assigned protected profiles, memory-only shared mode, account switching/logout, exact legacy recovery and explicit adoption. | A→B→A and delayed callbacks never mix data; legacy originals unchanged until explicit cleanup; V4–V8/partial/recovery/unknown/max-size fixtures round-trip. Assigned-laptop refresh/close/offline reopen retains work; shared mode explicitly loses unexported memory on refresh/close and leaves no private disk data. Two-tab/storage/crash/migration-race tests preserve all candidates. |
| 7S-B3: Reliable offline synchronization and conflict recovery | Transactional outbox, immutable receipts, foreground retry/metadata polling, strict incoming validation/quarantine, durable conflict review and Free quotas/compaction. | Simultaneous devices/first writes preserve both; lost reply/restart does not duplicate XP; edits during upload survive; wrong-owner late replies ignored. Pause/resume/429/receipt expiry/invalid remote/restore-epoch mismatch remain recoverable. Max-size transport passes; no unresolved-conflict eviction; measured normal/boundary database and egress fit the proposed cohort. |
| 7S-B4: Student-friendly account and sync controls | Clear device-choice wording, account/status controls beside existing toolbar, accessible private review/export/help and verified deletion process; no new primary tab. | Local-save versus cloud-confirmed is truthful; keyboard/screen-reader/375–390px checks pass; students can explain shared-mode loss limits and that **both kept** does not mean **combined**. OAuth account chooser/logout and deletion/support are exercised with authorized test accounts; no marketing or teacher data access. |
| 7S-C: Real-device security and student pilot testing | Physical iPhone/Android/assigned laptop/shared-profile matrix, authorized 30→60 classroom login exercise, actual-origin independent security/privacy sign-off, Free capacity/paused-project and operator recovery/rollback drill. | Each gate has recorded devices/network/URL/results. Review provider monthly/daily/hourly/NAT limits and free fallback before invitations; demonstrate valid versus invalid remote recovery and stale-client protection after restore. Then seek explicit approval for a bounded Free student pilot; no auto-upgrade or implied deployment approval. |

B3 should include a minimal truthful internal status while its flag is off; the polished student wording in B4 does not excuse silent failures earlier.

Keep **one separately reviewable PR for each of B1, B2, B3, B4 and C**; merge/deploy only with explicit approval. A spike lives within B1 as evidence and a decision, not an invitation to implement the later stages. The critical B1 result is demonstrated Auth/isolation and a maintainable server contract at $0; pilot school rollout, existing-data adoption and normal student use remain gated. No implementation work starts from this document update alone.

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

Also test unsupported future state/protocol, unsafe prototype keys/control characters, invalid dates, duplicate IDs, missing achievement fields, deep JSON, unsafe JS numbers, huge/escaped/multibyte payloads, and rate/quota abuse. Apply the section 5 matrix: some invalid app semantics may pass the **small server envelope** but must fail client validation/quarantine before adoption; unsupported protocol, wrong ownership, size/shape and abuse limits must fail on the server. A safe rejection/quarantine must not truncate a snapshot, change valid local/recovery bytes or destroy an earlier conflict. Test statement timeouts and repeated invalid writes with only authorized synthetic accounts.

### Data-loss, gameplay and device tests

* Concurrency: two clients from the same base, simultaneous first writes, local dirty versus remote dirty, conflict created while review is open, local edits after preview, same-workspace multi-tab interleavings and a suspended old client returning after an update. Exactly one expected-base write wins; every rejected candidate remains recoverable or pending locally if server persistence failed.
* Delivery: server commits then reply drops; retry before/after another device commits; crash before sending, after sending and before recording acknowledgment; outbox compaction; receipt pruning; throttling; airplane mode; captive portal; DNS failure; expired/refreshed tokens. No false “up to date” status.
* Rewards: same task completed on both devices offline, undo/re-complete, two same-day check-ins on different goals, WOOP/commitment repeated on both, legacy capped XP then new reward, achievement and parked/reactivated goals. Never sum competing totals or replay gameplay for a network retry. Preserve all seven families/28 forms.
* Recovery: every V4–V8 fixture including unknown nested fields and exact 2 MiB boundaries; partial V4 warning; restore/cancel/demo; corrupt originals and invalid cloud heads; disk full/blocked/evicted IDB; crash around each migration/import transaction; rollback/export bridge; account deletion with stale devices. Rehearse operator exports, missed-export handling and a database restore whose old revisions collide with an offline device; protocol reset must prevent stale writes. Verify student backups contain no tokens/sync internals or other users' data; operator exports require separate private access controls.
* Shared privacy: A logs out while a request/form/timer/file read is pending, B signs in, A's late result arrives; all other tabs/PWA contexts lock. Inspect localStorage, sessionStorage, IndexedDB, Cache Storage, browser history and logs for memory-only mode, including cleanup of the transient PKCE verifier. Check downloaded files remain a disclosed user responsibility. Test locked pending work cannot reopen under B and school-provider logout/account-chooser behavior is understood.
* Device categories: an individually assigned protected laptop retains pending work through close/reopen offline; a genuinely shared profile retains no private disk record and cannot recover memory-only work after close/refresh. Demonstrate both outcomes and the advance warning; do not call the shared case durable offline sync. Verify managed-profile cleanup risks and personally owned phone storage separately.
* Physical devices: school laptop browser (Chrome/Edge/managed Chromebook as applicable) paired with iPhone Safari **and** installed home-screen PWA; then Android Chrome **and** installed PWA. Repeat online/offline editing and review both directions, app kill/reopen, storage separation, blocked mail/OAuth, reconnect and verified worker update. No assumption that browser and installed app share storage/session. Use an approved HTTPS synthetic test host, never publish one implicitly.
* Regression UX: Today, My Week, My Goals, Learn, Coach; five-step creator and resumed draft; SMART = Specific, Measurable, **Agreed Upon**, Realistic, Timely; SMART+; WOOP = Wish, **Opportunity**, Obstacle, Plan with if–then; Wheel; timer; .ics; external prompt copy; achievement/collection/momentum; keyboard, reduced motion and readable status at phone/desktop widths. No embedded chatbot or hidden sharing.

Proposed status wording: **On this device only** (local-only), **Saved here · waiting to sync**, **Syncing**, **Up to date** (only after acknowledged head and no newer local work), **Sign in to continue syncing**, **Two versions need review**, and **Couldn't save here — download a backup**. Show cloud confirmation time on request; do not expose goal text in system notifications or turn a network outage into a full-screen blocker. A saved-state failure always takes priority over a cloud spinner.

### Release blockers

No students use cloud sync until all of these pass:

1. Anonymous/A/B isolation, narrow RPC privileges, session revocation/deletion and secret checks, with an independent review of the actual migration/functions.
2. Durable local/outbox transactions, same-base race preservation, lost-reply idempotency, account-switch fencing and quota/crash/data-loss tests.
3. Complete backup/import/recovery and exact XP compatibility, including maximum supported saves; a tested database restore and non-destructive rollback path.
4. School-approved OAuth or verified free-SMTP login on real phones/laptops, authorized **30–60 class sign-ins** including shared-NAT limits/resends, monthly quota headroom and working account recovery. Assigned versus shared-profile offline limits understood by students/educators.
5. Five-tab/gameplay/offline/accessibility regressions; physical Safari/iOS and Android evidence rather than viewport emulation alone.
6. **Mandatory actual Pages-origin inventory/security sign-off**; use an approved isolated HTTPS Pages origin if sibling code is not equally trusted. CSP/browser security findings must be resolved before minors' data, regardless of correct RLS.
7. Approved Free capacity/paused-project plan, named export operator/private storage/restore rehearsal, explicit recovery loss-window acceptance and no paid dependency. Proposed 30-person cohort must fit measured usage, not just average-size estimates.
8. Owner-approved youth privacy/consent, provider/region, server-validation boundary, retention/deletion/support and exact pilot scope; explicit release/deployment approval. Passing SQL tests alone is not release approval.

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
| Budget — already decided | **Free, $0/month, development/initial tests only.** No reapproval of Pro or paid staging is requested. Name the project owner; confirm an unused Free slot only when provisioning is separately authorized. If unavailable, use local tests. |
| Login | Choose **Google or Microsoft** based on the participating school's existing accounts and consent. Recommended: OAuth-only first. If email codes are needed, explicitly select a verified free provider/existing sender domain and approve its delivery/privacy/capacity tests; no purchase. Define graduation/lost-account recovery. |
| Device privacy | Approve memory-only shared default and opt-in durable mode for personal phones and **individually assigned protected school profiles**. School must confirm profile/privacy/cleanup policy; truly shared durable offline storage is out of scope. |
| Validation | Approve the eight-hour B1 feasibility timebox and recommended **small authoritative server security/resource contract + full existing JS validation/quarantine**. A cloud receipt is not full semantic certification. Record any alternative before extending work. |
| Client dependency | Approve the narrow official free Supabase-client exception, pinned/served locally with provenance and offline hashes. Any extra development packaging tooling needs its exact proposal approved; no framework or remote runtime loader. |
| Hosting/privacy | Name the actual Pages origin, origin/security reviewer and responsible privacy contact. Choose Canada Central subject to school approval; identify eligible jurisdictions/consent. If sibling content is not fully trusted, select an isolated no-cost Pages hostname or existing approved custom hostname before minors' data. |
| Retention/deletion | Approve/revise three accepted payloads, **30-day receipts, 7-day resolved conflicts**, unresolved conflicts until reviewed, 16 MiB/account and 10-conflict cap, project headroom thresholds, inactivity notice process and verified operator deletion route. |
| Recovery/operator | Name export/restore operator and backup operator, approved existing encrypted storage/second copy, seven daily exports/pre-change retention, up-to-24-hour loss and next-staffed-day recovery targets, identity-recovery limitation and protocol-reset procedure. No student pilot without a successful free restore drill. |
| Delivery | Final architecture approval first; then **separate authorization for 7S-B1 only**, including any Free project/provider setup. B2/B3/B4/C each get a separate reviewable PR. Student invitations/cohort size, enablement, merge and deployment remain separate decisions. |

**Beginner summary:** We would keep the existing app and add a private account copy that syncs between a phone and a protected school-laptop profile. Version checks keep conflicting work recoverable and retries do not add XP twice; edits are not automatically combined. Real shared computers keep work only while the page is open. Development stays at **$0 on Supabase Free**, using invented records and authorized test accounts. School Google/Microsoft login is the preferred no-email-cost pilot path; free email codes have strict quotas. Free can pause, fill up and has no included automatic database backups: private manual exports and tested recovery have limits. Approve the validation/client approach, school login/device/privacy choices, isolated Pages origin and recovery responsibilities, then authorize B1 separately. No provisioning, implementation, student data changes, merge or deployment is authorized by this revision. Stop for final architecture approval.
