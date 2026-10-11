# ARCHITECTURE — runtime facts, as built

Updated in the same PR that ships behavior. Designs describe what is planned.

As of 2026-10-11 (K-2): **the foundation and the executable conformance harness exist.** No Vercel project, Neon
database, relay repository or keys exist for this repo yet (IN-02, IN-03, IN-04).

## Built in D-1c (PR #14)

| What | Where | Notes |
|---|---|---|
| OS credentials | packages/cli/src/keychain.js | Native Linux, macOS, Windows keychains; pass delivered over child stdin, never argv or source. |
| Hidden login | packages/cli/src/input.js | Silent terminal input, RTC format validation before saving. |
| Keychain CLI | packages/cli/src/commands.js | Login verifies whoami before store; logout deletes only local record; missing keyring isolates service. |

Cross-platform native invocation plans are unit-tested, but actual device smoke has not run.

## Built in D-1b (PR #13)

| What | Where | Notes |
|---|---|---|
| Type-aware SDK generator | packages/cli/src/sdk.js | Reads a real RTC catalog, generates callable ES modules plus TypeScript declarations by area. The runtime reads passes only at invocation; output must not already exist. |
| Agent guidance | packages/cli/src/setup.js | rtool skill and init, managed AGENTS.md block, refuses symlinks and malformed managed blocks. Only direct HTTPS claimed until relay exists. |
| Tested standalone SDK | packages/cli/test/sdk-setup.test.js | Live fake-server calls through generated functions; read-only/confirmation and no-pass persistence exercised. |

**Not built:** final declaration compiler gate, relay, local MCP, hosted hub.
Next D-1 finishes keychain and release readiness.

## Built in D-1a (PR #12)

| What | Where | Notes |
|---|---|---|
| rtool direct CLI | packages/cli/bin and src/commands.js | Real HTTP calls to RTC 1 service doors. Supports servers, whoami, tools, describe, call, batch and result. |
| Safe config | packages/cli/src/config.js | URL-only servers.json and RTOOL_SERVERS overrides; bearer passes only via env for now. OS keychain comes in D-1. |
| Server routing | packages/cli/src/dispatch.js | Prefix-to-server discovery, qualified override if same prefix exists, missing passes disable only that server. |
| Result output | packages/cli/src/pages.js | Handles catalog continuation, full handle materialization to a user-chosen new 0600 file with a 50 MB cap. |
| Error behavior | packages/cli/src/http.js | Stable exit codes and redacted error text; server guards remain authoritative. |

SDK, OS keychain, setup skill and initialisation are not yet built (next D-1 PR).

## Built in K-2b (PR #11)

| What | Where | Notes |
|---|---|---|
| OAuth safety | packages/conformance/src/oauth.js | Local fixture adapter compares settings across token refresh; no debug endpoint in production. |
| Shared limits | packages/conformance/src/rate-limit.js | Concurrent requests to two distinct loopback processes. |
| Subprocess | packages/conformance/fake-server/instance.js | Atomic Postgres test counter, or deterministic failing in-memory variant. |
| Release pointer | .github/workflows/tag-conformance.yml | Creates immutable conformance-v1 tag on main; no credentials stored. |

Without both local fixtures the extended suite reports skips and cannot certify a server.

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

`packages/conformance` release tagged after K-2b, `packages/core` (K-3), `rtool` SDK/login/skill/init (D-1), local MCP (D-2), the GitHub relay
`api/relay/github.js` with table `relay_seen` (D-3), the hub server with `hub_servers` and `hub_change_log` (H), workflows
(C), local tools (L). The `test:doors` script arrives with D-1; `test:conformance` is now real.
