# B1 revised proposal: trusted session identity, restricted progress writes

Status: **prepared for review; no migration applied; hosted behavior unverified**. October 18, 2026. Responds to the [review of commit 82695b3](https://github.com/Geng-Geng8/goal-quest/pull/8#pullrequestreview-5561700061).

## Decision and alternatives

Prepare option B: one no-argument `private.current_student_id()` helper, owned by the existing ordinary `postgres` operator, that returns **only the current verified active account UUID or NULL**. It reads identity/session information and never accesses progress tables. The actual progress writer remains owned by `h4_sync_writer`, with no LOGIN, INHERIT, SUPERUSER or BYPASSRLS, and remains subject to forced RLS on both progress tables. No new role, Auth provider/hook, backend, Edge Function, service key, infrastructure or paid feature is introduced.

Option A (direct grant) was investigated again. The [official role troubleshooting guide](https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c) explains that managed schemas do not grant PUBLIC usage and ordinary `postgres` cannot administer privileges on objects it does not own. The [GRANT rules](https://www.postgresql.org/docs/17/sql-grant.html) require ownership or a grant option. The live audit still shows neither for delegating `auth` usage. No documented self-service mechanism was found that gives this exact narrow permission to the custom writer without special managed-role authority. This is a bounded documentation finding, not a claim that every possible Supabase operation was disproven. No support request was sent, and no special administrator grant, schema-owner change or role-membership workaround is assumed.

Private, narrowly scoped definer helpers are an established [Supabase RLS pattern](https://supabase.com/docs/guides/database/postgres/row-level-security#use-security-definer-functions). That supports the mechanism, **not automatic security approval of this particular implementation**. Option B remains a candidate until code review plus real SQL/HTTP tests pass. If it fails those gates, stop and review rather than broadening privileges.

## New boundary

```text
Verified Supabase/PostgREST request claims
    -> private.current_student_id()       [postgres, SECURITY DEFINER]
       auth.uid(), auth.jwt(), auth.sessions(id,user_id) only
       -> own active UUID, or NULL
    -> restricted progress writer + four ownership policies
       [h4_sync_writer, non-owner, NOBYPASSRLS; forced RLS]
    -> versioned head, receipts, preserved conflicts
```

`postgres` is privileged and has BYPASSRLS on this project. The helper is therefore a **trusted code boundary**: its safety depends on its reviewed body, immutable signature/grants and trusted deployment control. It contains no progress read/write, mutation, dynamic SQL, caller-supplied identity, caller-supplied session ID, arbitrary table lookup, configuration change, provider token handling or raw Auth disclosure. Its only output is the caller's own active UUID. The writer does not become `postgres`; function-call privilege context is restored on return, and tests assert this explicitly.

The helper uses the existing `auth.uid()` and `auth.jwt()` APIs. It requires a non-null valid UUID, signed request role `authenticated`, non-anonymous Auth, unexpired numeric `exp`, and an `auth.sessions` row whose ID matches the verified JWT `session_id` **and** whose owner matches that UUID. Missing, malformed, expired or foreign-session context returns NULL. Deleting/revoking that session blocks subsequent reads and writes despite a still-unexpired access token. Checks use database statement snapshots; this is not a promise to cancel an already-running request instantaneously.

There is no custom token verification or authentication protocol here. Supabase Auth/PostgREST **must verify signatures, issuer/project and expiration before installing transaction-local request claims**. Browser callers cannot supply the helper's identity through an argument. `user_metadata`, names, email and school domains do not authorize anything. Direct SQL credentials and a privileged operator who can `SET request.jwt.claims` remain trusted; SQL test claim simulation does not prove HTTP JWT verification. Do not expose any general SQL, `set_config`, claim-setting or equivalent privileged RPC. A read-only inventory found only `sync_progress` in `public` on this test project. The `private` schema must remain absent from Data API exposed schemas; real HTTP checks for that remain required.

The helper is in `private`, has zero arguments, returns UUID, is STABLE, fixes `search_path = ''` and qualifies all Auth object references. Default PUBLIC/anon/authenticated/service-role execution is explicitly revoked, then execution is granted only to `authenticated` and `h4_sync_writer` (plus intrinsic ownership rights). Do not expose it through a public wrapper/view. The existing boolean `has_current_session()` becomes a tiny **SECURITY INVOKER** compatibility wrapper, still owned by the restricted role, returning whether the same UUID helper is non-null.

All four read/write policy predicates use `user_id = (select private.current_student_id())`; write policies keep both USING and WITH CHECK. NULL authorizes no rows. Policy roles, forced RLS, table ownership and SELECT-only browser grants are unchanged. The progress function changes just its initial identity source and null guard; its advisory lock, revision validation, server hashing, immutable request deduplication, CAS, quotas, compaction and conflict preservation remain the same. The public RPC is still an invoker with no owner parameter. Source-contract tests compare the entire writer body to the baseline after exactly those two substitutions; this is useful review evidence, not execution of SQL.

## Precisely required existing permissions — demonstrated on Free

Read-only catalog and zero-row execution checks on the authorized disposable project returned PostgreSQL **17.11**, current/session operator `postgres`, and:

| Existing permission | Live result / why needed |
| --- | --- |
| `postgres`: CREATE on `private` | true; create the helper in the existing unexposed schema |
| `postgres`: USAGE on `auth` | true; resolve Auth objects, without granting that permission onward |
| `postgres`: EXECUTE `auth.uid()`, `auth.jwt()` | both true; existing official identity context APIs |
| `postgres`: SELECT `auth.sessions.id`, `.user_id` | both true; actual zero-row SELECT also passed |
| `postgres`: SET membership in `h4_sync_writer` | true, already granted by the baseline; permits replacing writer-owned routines without elevating the writer |
| Existing progress tables/policies | owned by the migration operator; current four ownership policies audited; unchanged forced RLS is checked before commit |
| `h4_sync_writer`: Auth USAGE | **false**; deliberately remains unnecessary in the new design |
| `h4_sync_writer`: LOGIN/INHERIT/BYPASSRLS/SUPERUSER | all false; deliberately unchanged |
| `postgres`: Auth USAGE WITH GRANT OPTION | **false**; deliberately unnecessary |

`supabase/tests/session-helper-prerequisites.sql` was executed on the hosted project as a **read-only transaction** and returned `PASS: ordinary postgres helper prerequisites; no migration applied`. It calls both Auth helper functions without returning their data and checks session-column resolution with `WHERE false`. It creates nothing and changes no grants, roles, rows or configuration. These results demonstrate prerequisites on **this** Free project, not that the unapplied implementation or every fork is already verified. The new migration repeats fail-closed prerequisite checks. Existing source/catalog owner information established that the operator owns `private` and the two progress tables; ordinary ownership permits policy changes and managing its new helper's EXECUTE ACL.

The baseline's now-unused direct function/session-column grants to the writer are not widened or relied on; without Auth schema USAGE they are inaccessible. The correction makes **no grant/revoke on any managed Auth object**. No managed schema ownership, platform role or additional privileged role is required.

## Migration handling

- Keep the deployed original `20261018051112_phase_7s_b1_foundation.sql` byte-for-byte unchanged.
- Remove **unapplied** `20261018054455_phase_7s_b1_writer_auth_usage.sql` from the pending migration chain. Its managed-schema grant path was blocked and no grant was applied. Its historical diagnosis remains in the superseded report. Keeping it pending would abort an ordinary Free installation before the replacement could run.
- Review new `20261018061330_phase_7s_b1_trusted_session_identity.sql`: one transaction creates the no-argument helper, converts the boolean wrapper to invoker, updates four policies, and replaces the write body with just the identity/guard changes. It asserts the restricted write owner and forced RLS are preserved. CREATE OR REPLACE preserves the existing owner/grants of writer routines; no ownership is transferred to `postgres` except the new identity helper it creates itself.
- Existing project: after **separate application approval**, run only the new reviewed migration as ordinary `postgres` on the authorized disposable project. Do not reapply/recreate the baseline. If baseline was manually applied, reconcile the existing migration-history process before using any bulk CLI push; do not blindly replay files. Fresh fork/test database: run the unchanged baseline followed by this new migration, then the tests. The baseline's ineffective Auth GRANT warning is historical; the new design does not depend on it and must pass with writer Auth USAGE still false.
- The transaction rolls back on any prerequisite/postcondition failure. No progress/state migration, row deletion or student data adoption is performed. **Neither new migration nor pending SQL fixture suite was applied/executed by this task.**

## Tests and required hosted verification

Prepared SQL/HTTP tests are real tests, not stubs; they have **not run against the new implementation**, because applying it is explicitly forbidden in this assignment.

1. Before any application: review this helper's complete source and permissions, inspect the migration diff, confirm `private` is not exposed, and run the read-only prerequisite script. The latter passed here. No third-party credentials or service key are needed.
2. After owner approval/application: run `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/writer-permissions.sql`. It checks private helper ownership/signature/ACL/search_path and writer attributes. It then calls the helper under `h4_sync_writer` while direct `auth.uid()` still fails. This is the regression for the original schema-permission failure: the writer must now work **without** that permission. If an interactive SQL error leaves a transaction aborted, ROLLBACK before retrying.
3. Run `supabase/tests/session-identity.sql` as a complete rollback transaction. It tests active A/B, wrong-session ownership, missing/malformed subject/session/expiry, expired claims, anonymous Auth, wrong role, user-metadata spoofing, zero owner arguments, browser denial of raw Auth reads, post-call writer role restoration and revocation. These SQL claim simulations must be followed by real HTTP tests.
4. Run complete `supabase/tests/foundation.sql` and `supabase/tests/limits.sql`, with error-on-failure. Cross-account isolation, anon and direct-write denial, writer reassignment failure, transactional conflicts, idempotency, quotas/compaction, session revocation and deletion cascades remain required. Do not weaken failures or grant the writer schema privileges to make them pass.
5. With separately authorized fresh adult test sessions, run `node --test tests/cloud-security.integration.mjs`. Use only publishable key + A/B JWTs and an actually expired signed test JWT; keep them private, out of logs/Git. The suite checks real REST ownership/counts, direct write denial, CAS/retry preservation, forged/expired/revoked sessions, parser/2MiB transport and now denial of public/private-profile helper RPC exposure. It requires the approved synthetic environment flag and refuses existing heads. No accounts or project are created by the tests.
6. Run Supabase Security Advisor and inspect catalog grants/owners and exposed schemas again. The reviewed private `postgres`-owned definer is intentional, but a clean advisor is not proof that it is safe. Recheck that no browser can replace the helper or writer, assume a privileged role or install arbitrary request claims. Record measured timeouts/resource tests, actual OAuth on authorized adult laptop/phone accounts, and the remaining B1/pilot gates separately. Existing school/Pages/privacy/recovery requirements remain closed for student use.

**Actual local results:** `node --test tests/*.test.mjs`: 129 passed. This includes two new SQL source-contract checks, not a mock claim of database security. The HTTP suite was invoked with no A/B JWT configuration and explicitly skipped. `git diff --check` passed. Existing browser suites were not rerun: runtime/UI/worker assets have no changes. Their earlier results remain historical.

**Recommended next action:** review this proposed split boundary, then explicitly authorize test-only migration application and run the hosted matrix above. Successful prerequisites alone do not approve the implementation, merge, deploy, OAuth registration or student use. If any security/maintainability gate fails, stop and review; no privilege expansion or paid fallback is authorized.
