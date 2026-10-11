# K-2b — OAuth refresh and two-instance rate limits

Status: MERGED (#11), as-if-merged documentation for the PR gate.
Batch K approved amendment 2026-10-10. Prerequisite K-2 merged (#10).
Baseline 98e887348d23effe3c2f8205c185b8317043d7e9.
Risk area: authentication and request-limiting conformance; no production migration.
Size below 500 production lines because K-2's reusable framework is already built.

## Read only these

- CONTRACT sections 2 and 9; BATCH-K amendment; K-2 conformance runner and fake.
- tests/db/isolated-schema.js, SESSION-START sections 0–6, AI-PR-READ-FIRST.

## Drift check A

| Assumption | Actual | Kind | Action |
|---|---|---|---|
| HTTP fake and runner exist | K-2 PR #10 | Match | Extend |
| OAuth refresh can widen permissions | Contract section 2 | Known risk | Inspect settings before and after |
| Instance memory cannot guard a shared limit | K-0 database harness | Known risk | Two processes, one Postgres |
| One remote URL can prove two instances | Contract says no | Match | Skipped rather than certified |

## Build and safety

- Minimal HTTP OAuth refresh fixture rotates the refresh token and copies every connection
  setting: profile, listing, areas, mode and account. The deliberate broken fixture
  widens permissions and must be caught by the conformance probe.
- The local fake's test-only settings introspection must not be deployed on production
  servers; real servers supply their own CI fixture adapter.
- Two independently started Node processes use identical passes and overlap requests.
  Atomic Postgres upsert enforces exactly the limit; in-memory per-process counters fail.
  Temporary schemas and child processes are cleaned up after tests.
- Runs without a server-owned OAuth adapter or a second process report skipped and
  cannot claim the complete RTC certificate.
- The main-only tag workflow creates an immutable conformance-v1 tag after this PR merges.

## Tests and done when

- OAuth positive and negative tests and deliberately broken refresh regression.
- Actual multi-process database test: shared Postgres passes, in-memory fails.
- npm run check, npm test, npm run test:conformance, npm run test:db; CI green at exact head.
- Next: D-1 direct CLI. K-3 requires Stripe A-C.
