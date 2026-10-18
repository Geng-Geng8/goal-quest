# B1 follow-up: missing Auth schema USAGE

Status: **superseded historical proposal, never applied**. October 18, 2026. The [revised trusted session helper](./PHASE_7S_B1_TRUSTED_SESSION_HELPER.md) replaces the grant-dependent approach and its pending migration. Keep the root-cause evidence below as history; **do not follow the old application steps or seek managed administrator access**. PR #8 stays draft.

Addresses the [owner's live-test review](https://github.com/Geng-Geng8/goal-quest/pull/8#pullrequestreview-5561621810). The owner created the authorized disposable Free project and applied the original B1 migration. The first synthetic SQL test failed before any A progress write. No Google OAuth or student use is enabled.

## Confirmed diagnosis

A read-only catalog audit of the authorized test project, PostgreSQL 17.11, returned:

| Check | Actual result |
| --- | --- |
| Operator / session user | `postgres` / `postgres` |
| `auth` schema owner | `supabase_admin` (Supabase managed) |
| `postgres` is superuser | false |
| `postgres` effective Auth `USAGE` | true |
| `postgres` Auth `USAGE WITH GRANT OPTION` | **false** |
| Writer Auth `USAGE` | **false** |
| Writer public/private schema `USAGE` | true / true |
| Writer `auth.uid()` / `auth.jwt()` `EXECUTE` | true / true |
| Writer `auth.sessions.id` / `.user_id` `SELECT` | true / true |
| Writer LOGIN / INHERIT / BYPASSRLS / SUPERUSER | all false |

The original `GRANT USAGE ON SCHEMA public, auth TO h4_sync_writer` incorrectly assumed the migration operator could delegate usage on both schemas. It can delegate `public` usage, but the managed `auth` ACL gives `postgres` usage **without** its grant option. `BYPASSRLS` on `postgres` does not make it a superuser or permit granting another owner's schema privilege. Function EXECUTE and column SELECT grants do not supply schema lookup permission.

PostgreSQL permits a GRANT by a non-owner with some object access to finish with a warning while granting only privileges it can delegate. A successful migration transaction therefore did not establish this permission; the original migration lacked an effective-privilege assertion. The original warning transcript is not available, but the exact checked-in statement and live ACL/grant-option results explain why it cannot grant Auth USAGE as `postgres`. [PostgreSQL GRANT behavior](https://www.postgresql.org/docs/17/sql-grant.html).

At runtime `private.write_progress` executes as `h4_sync_writer`. Its declaration initializes `owner_id` with `auth.uid()` before entering the function body, so missing schema USAGE raises `42501` immediately. The session helper also requires this same schema access. Turning INHERIT on, granting a broad built-in role, changing search_path, changing table ownership or weakening RLS would not be an acceptable correction.

## Minimal additive correction

Review `supabase/migrations/20261018054455_phase_7s_b1_writer_auth_usage.sql`. Its **only privilege mutation** is:

```sql
grant usage on schema auth to h4_sync_writer;
```

The transaction first checks whether the privilege already exists. If missing, it requires an authorized owner/grantor with effective `USAGE WITH GRANT OPTION`; otherwise it raises `42501` with an actionable hint **before** attempting the grant. It then asserts effective schema usage and the existing narrow function/session-column privileges. Re-running after an authorized grant is a verified no-op. It adds no grant option, schema CREATE, role membership, table/function access, ownership change or RLS change. The original applied migration is unchanged.

**Hosted application blocker:** the audited SQL-editor/MCP `postgres` role cannot supply this grant. Merely pasting the correction into the same SQL editor as `postgres` will intentionally fail, clearly, instead of silently succeeding. Owner approval alone does not confer the platform's database permission. Arrange an authorized Supabase schema-owner/grantor operation for this exact grant; do not attempt to assume `supabase_admin`, obtain managed-role credentials or alter the managed schema's owner. No support message has been sent. If no authorized no-cost path is available, keep hosted B1 blocked and seek a separately reviewed design decision; do not purchase services or widen the writer's role.

## Regression and actual results

- Added `supabase/tests/writer-permissions.sql`: a **read-only** effective-permission preflight followed by actual Auth name resolution under `SET LOCAL ROLE h4_sync_writer`. It calls the two Auth identity functions without returning their values and prepares a zero-row session-column read. It creates no objects and changes no grants or records.
- Executed that read-only preflight on the still-uncorrected authorized project. It **failed as expected** with `42501: B1 preflight: h4_sync_writer lacks effective USAGE on schema auth`. This demonstrates the regression detects the actual missing permission; it is not a passing security test or verification of the unapplied correction.
- Added explicit effective Auth schema/function/column checks to `supabase/tests/foundation.sql` before synthetic records and the first RPC. Added the schema check to the quota suite too. Existing cross-account, anonymous, direct-write, revoked-session and restricted-writer tests remain intact.
- `node --test tests/*.test.mjs`: **127 passed, 0 failed**. The student app, original migration, runtime modules, styles, worker and V4 fixture are unchanged. Browser suites were not rerun for this SQL/test/documentation-only follow-up; the prior 69 browser and two synthetic SDK/CSP results remain historical evidence.
- No corrective migration, permission change, synthetic data write, OAuth configuration, paid service, deployment or merge was executed. The full SQL/REST security suites have not passed yet; successful-path preflight and correction application remain unverified.

## Safe application and verification after review

1. Confirm the intended target is the same authorized disposable Free project, using private project notes/dashboard. Do not use any existing live project. Review the migration and retain the current catalog audit below. If an earlier SQL test left an aborted transaction in an interactive editor, issue `ROLLBACK` before starting a new operation.
2. Have an **authorized managed-schema owner/grantor** review and run the corrective transaction, or supply only the exact schema-USAGE grant above. No `WITH GRANT OPTION` or role elevation is needed for the writer. If a platform operator supplies the one grant separately, the owner can then run the reviewed corrective transaction as `postgres` to assert the already-effective result. Follow the existing SQL-editor/manual-migration-history procedure; do not bulk replay the original migration or blindly `db push` when its manual application is not registered in CLI history.
3. In a fresh session, rerun the catalog query below. Expect `writer_auth_usage = true`; its existing identity-function and session-column grants must still be true. `writer_auth_create`, `writer_can_delegate_auth_usage` and the four elevated-role attributes must remain false. RLS/force-RLS, function owners and grants must still match B1; the unchanged catalog assertions in `foundation.sql` check those boundaries.
4. Run `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/writer-permissions.sql` with the approved private operator connection, or execute the **entire** file in a fresh SQL-editor transaction. Expected: preflight and actual restricted-role name resolution pass, then rollback. This positive result is still pending. Do not record a permission-only pass as proof of account isolation.
5. Run the **entire** updated `supabase/tests/foundation.sql` and `supabase/tests/limits.sql` with error-on-failure; both are synthetic rollback suites. Retain actual failures and stop on any new error. Then rerun Security Advisor, real A/B/anonymous/forged/expired/revoked JWT HTTP tests and the remaining B1 gates. A clean advisor alone is insufficient. Real Google OAuth remains separately untested.

This diagnostic is read-only and exposes no student rows, tokens or secrets:

```sql
select current_user,
  (select pg_get_userbyid(nspowner) from pg_namespace where nspname = 'auth') as auth_owner,
  has_schema_privilege(current_user, 'auth', 'USAGE WITH GRANT OPTION') as operator_can_grant,
  has_schema_privilege('h4_sync_writer', 'auth', 'USAGE') as writer_auth_usage,
  has_schema_privilege('h4_sync_writer', 'auth', 'CREATE') as writer_auth_create,
  has_schema_privilege('h4_sync_writer', 'auth', 'USAGE WITH GRANT OPTION') as writer_can_delegate_auth_usage,
  has_function_privilege('h4_sync_writer', 'auth.uid()', 'EXECUTE') as uid_execute,
  has_function_privilege('h4_sync_writer', 'auth.jwt()', 'EXECUTE') as jwt_execute,
  has_column_privilege('h4_sync_writer', 'auth.sessions', 'id', 'SELECT') as session_id_select,
  has_column_privilege('h4_sync_writer', 'auth.sessions', 'user_id', 'SELECT') as session_user_select,
  rolcanlogin, rolinherit, rolbypassrls, rolsuper
from pg_roles where rolname = 'h4_sync_writer';
```

The grant has not been applied by this task. If a later approved application causes an unexpected issue, stop test writes and review the permission diff. A schema-owner operator can revoke this one writer USAGE grant to restore the original blocked state; this does not require deleting progress or disabling RLS. Do not automatically revoke an independently approved grant that already existed before the correction.

**Next action:** review the additive correction and arrange the narrowly authorized schema-owner grant path. Keep PR #8 draft and the student app local-only until real B1 security tests pass. No merge, deploy or correction application is authorized by this follow-up.
