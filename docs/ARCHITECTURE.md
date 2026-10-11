# ARCHITECTURE — runtime facts, as built

Updated in the same PR that ships behavior. Designs describe what is planned.

As of 2026-10-11 (K-2): **the foundation and the executable conformance harness exist.** No Vercel project, Neon
database, relay repository or keys exist for this repo yet (IN-02, IN-03, IN-04).

## Built in K-2 (PR #10)

| What | Where | Notes |
|---|---|---|
| RTC fake server | `packages/conformance/fake-server/server.js` | Node HTTP on loopback only; random passes, guarded read/write, batch and handles; deliberate fault switches. Test behavior only, not a public service. |
| Conformance runner | `packages/conformance/src/run.js` | Real HTTP checks of manifest, OpenAPI, catalog, meta, reads, writes, passes, error safety and compact budget. No keys logged. Missing roles are skipped, not passed. |
| Conformance CLI | `packages/conformance/bin/rtc-conformance.js` | Env-name flags, exit status 0/1/2; root `npm run test:conformance` exercises fake and negative probes. K-2b will add OAuth refresh/two-instance checks. |

## Built

| What | Where | Notes |
|---|---|---|
| Node project | `package.json`, `package-lock.json` | Node 24.x, ES modules, npm workspaces `packages/*` (none yet), exact dev versions: eslint 10.12.0, vitest 5.0.3, pg 8.23.1, yaml 2.9.1. No runtime dependencies. |
| Quick gate | `npm run check` | `scripts/check-secrets.mjs` (every tracked and untracked file; prints only label, file, line, first 6 characters), `scripts/check-docs-updated.mjs`, `docs/pr-cards/validate-index.py`, `eslint .` |
| Unit tests | `npm test` → `vitest.config.js` | `tests/unit/**` and `packages/*/test/**` (except `test/db`) |
| Database tests | `npm run test:db` → `scripts/local-postgres-test.sh`, `vitest.db.config.js` | Localhost Postgres only (refuses any other host). `tests/db/isolated-schema.js`: one throwaway schema per file; `pool()` = an independent pool standing in for a second serverless instance. |
| CI | `.github/workflows/ci.yml` | Jobs `check`, `unit`, `db` (Postgres 17 service from the ECR mirror), aggregate `ci` (merge gate). `permissions: contents: read`, no secrets, no `pull_request_target`; guarded by `tests/unit/ci-workflow.test.js`. |

## Planned (not built)

`packages/conformance` OAuth/two-instance extensions (K-2b), `packages/core` (K-3), `rtool` CLI and local MCP (D-1, D-2), the GitHub relay
`api/relay/github.js` with table `relay_seen` (D-3), the hub server with `hub_servers` and `hub_change_log` (H), workflows
(C), local tools (L). The `test:doors` script arrives with D-1; `test:conformance` is now real.
