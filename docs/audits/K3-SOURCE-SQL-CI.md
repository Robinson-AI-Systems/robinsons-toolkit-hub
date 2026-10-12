# K-3 authentic Stripe SQL source CI proof (bounded)

This job checks out the **real Stripe service repository**, not a hand-recreated adapter or mocked production SQL, at reviewed immutable commit `e3c5b34bccabec11328d62f4ca45145163772486`. It runs original service-owned tests against the disposable PostgreSQL 17 CI container. Its result is a required dependency of hub `ci`. GitHub source code is read only; no Stripe API key, production database, pass, web login or external money transfer is used.

The exact source database implementation is `src/db.js`: OAuth code consumption uses an atomic hash-bound DELETE/RETURNING; refresh rotation uses one guarded UPDATE/RETURNING of the existing connection row; approvals and reservations use service-owned account-scoped SQL. Tests prove portions of these behaviors at the pinned original service revision, including owner decision intent races, above-cap separate override, concurrency, revocation, and persisted connection settings. This is **source test execution**, not merely a copy of SQL into a hub fixture.

Run through `.github/workflows/ci.yml` on PR and main. The job fails on inaccessible source checkout, SHA mismatch, failed original test, inaccessible PostgreSQL, missing dependency or non-success of any required job. Ordinary hub check/unit/db jobs remain required.

**Limitations:** The source pin is not current-service adoption, final-candidate drift reconciliation or deployed production SQL. The tests execute original service-owned database methods but do not exercise an independently authenticated human owner browser session, LIVE activation, connected Stripe API, separate Workspace adoption, or a released shared core. K-3 stays **IN_PROGRESS / NOT READY / NOT RELEASED**. Re-pin this immutable source only after explicit drift review and inspect all changed source/test files; never follow moving Stripe main implicitly. D-4 remains WAITING_ON_OWNER.

## Verification
- Real GitHub Actions `stripe source SQL (reviewed immutable commit)` job on exact PR head plus aggregate `ci` are required.
- No local GitHub checkout is available in the current API-only workspace: this document does not claim locally executed SQL.
