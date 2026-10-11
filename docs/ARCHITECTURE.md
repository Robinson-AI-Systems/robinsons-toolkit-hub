# ARCHITECTURE — runtime facts, as built

Updated in the same PR that ships behavior. Designs describe what is planned.

As of 2026-10-11 (#20): **foundation, conformance, direct doors and encrypted relay code exist.** No Vercel project, Neon
database, relay repository or keys exist for this repo yet (IN-02, IN-03, IN-04).

## Built in K-3a (PR #22)

`packages/core` (private, unshipped) copies Stripe MCP `src/core/oauth.js` and
`crypto.js` unchanged at source main `09ed53a048820989a3f69c057ebf8a6be0c2a988`.
Public subpath exports `./oauth` and `./crypto` require no SDK or provider account.
Security tests retain upstream assertions; the login store is injected only in
unit tests. Distributed lockout remains the adopting server's SQL responsibility.
No release, adoption, secret, or production capability exists from this slice.

## Built in D-4a (PR #20)

| What | Where | Notes |
|---|---|---|
| Agent verification | scripts/agent-check.mjs; packages/cli/src/agent-check.js | Env-name pass/args only, default localhost boundary, read_only profile and non-writing metadata required, real read/handle, observed route per probe; neutral output. |
| Agent recipes | docs/AGENT-SETUP.md | Local/cloud Claude/Codex, Cursor, Copilot, Actions, Vercel Sandbox and Docker; pinned reviewed commit, direct/relay/MCP/SDK doors. |
| Real-run acceptance | docs/pr-cards/D-4.md | WAITING for owner-authorized three-route evidence and test-pass revocation. |

This is verification infrastructure, not certification of any real hosted route.

## Built in D-3 (PR #19)

| What | Where | Notes |
|---|---|---|
| Relay HTTP door | packages/relay/src/routes.js | Reserved rtc.http envelope allows exact manifest/whoami/tools/batch/results paths and bounded query fields only; no arbitrary URLs. |
| CLI routing | packages/cli/src/relay-route.js; http.js; dispatch.js | Direct first, fallback on reads or proved pre-connect POST failure; server refusals and ambiguous writes never retried; server passes stay in encrypted envelope. |
| Ciphertext cleanup | api/relay/cleanup.js; packages/relay/src/cleanup.js | Separate bearer, configured private-repo issues, ciphertext older than one hour, explicit bounded/failure handling; prune old seen IDs after comment cleanup. |
| Hourly scheduler | .github/workflows/relay-cleanup.yml | Inert until owner supplies URL variable and cleanup bearer secret. No GitHub token permissions; no paid Vercel cron configured. |
| Setup | docs/RELAY-DEPLOY.md | IN-02/03/04 remain unmet; no deployed/live smoke claim. Generated standalone SDK bundles the relay-capable runtime; passes remain environment-only. |

Client env: `RTOOL_RELAY` (public repo/key/alias→issue JSON),
`RTOOL_RELAY_TOKEN` (private agent one-repo token), plus the normal server pass.
`RELAY_CLEANUP_SECRET` is a separate hosted/scheduler bearer. Scheduler timing is
best effort; its failure is visible in Actions. No production settings supplied.

## Built in D-3b (PR #18)

| What | Where | Notes |
|---|---|---|
| Signed webhook | api/relay/github.js; packages/relay/src/webhook.js | Original raw bytes, HMAC-SHA256 timing-safe check; created comments on configured private repo/issue/actor only. |
| Replay store | packages/relay/migrations/001-relay-seen.sql; src/store.js | Atomic unique request ID insert; no passes/args/results at rest; claims retained after failed writes/posting. |
| RTC forwarding | packages/relay/src/forward.js; src/server.js | Fixed HTTPS server origins, redirects refused, original pass and guards, encrypted reply with bounded sizes and accidental credential echo redaction. |
| Lazy runtime | packages/relay/src/runtime.js; src/handler.js | Missing settings disable relay only; pool and configuration created on first request; generic public errors. |

Required owner environment: `RELAY_REPOSITORY`, `RELAY_WEBHOOK_SECRET`,
`RELAY_GITHUB_TOKEN`, `RELAY_PRIVATE_KEY` (base64 PKCS8 DER X25519),
`RELAY_SERVERS` (alias to HTTPS origin), `RELAY_BINDINGS` (issue to actorId/server),
`RELAY_DATABASE_URL` (TLS Postgres). All secrets set privately; never put in repo.
Deploy/migration and cleanup are retained for D-3; owner gates remain IN-02/03/04.

## Built in D-3a (PR #17)

| What | Where | Notes |
|---|---|---|
| Relay envelope crypto | packages/relay/src/crypto.js | X25519 ephemeral exchange, HKDF-SHA256, AES-256-GCM authenticated messages; reply key sealed inside request; timestamp and request ID authenticated. |
| GitHub comments client | packages/cli/src/relay.js | Fixed GitHub API origin and scoped repository/issue, ciphertext-only bodies, bounded poll, delete request and reply comments, no token passed to GitHub body. |
| Security tests | packages/relay/test/crypto.test.js and packages/cli/test/relay-client.test.js | Tamper/wrong-key/replay-window tests, fake Github API encrypted round trip and cleanup. |

D-3b supplies the server boundary. D-3 retains route fallback, cleanup and deployment recipe.

## Built in D-2 (PR #16)

| What | Where | Notes |
|---|---|---|
| Local stdio MCP | packages/cli/src/mcp.js | MCP JSON-RPC 2.0 (2025-11-25), one UTF-8 JSON message per line. Handles initialize, ping, tools/list, tools/call. No stdout logs or secrets. |
| Six broker tools per service | alias_search, alias_describe, alias_call, alias_batch, alias_result, alias_whoami | Service-alias prefix, tiny schemas rather than thousands of provider schemas; runtime server remains safety authority. |
| Two-server integration | packages/cli/test/mcp.test.js | Two separate RTC loopback servers prove direct read, guarded writes and denial; catalog under 5000 estimated tokens. |

## Built in D-1 (PR #15)

| What | Where | Notes |
|---|---|---|
| SDK compiler gate | packages/cli/test/typescript.test.js | Strict TypeScript compiler checks actual generated declaration files and deliberate expected input type errors. |
| Door scripts | package.json | npm run test:doors and test:types, both real runnable suites. |
| CLI distribution | .github/workflows/tag-cli.yml | Immutable cli-v1 tag on verified main push, single tag only. |

Real device smoke for native credentials remains unverified; hosted services and GitHub relay are not yet provisioned.

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

**Not built:** GitHub relay and hosted hub; local MCP is now built.
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

Shared `packages/core` extraction (K-3), new-server scaffold (K-4), hosted hub (H),
workflows (C) and local tools (L). D-4 real environment proof and native OS credential
smokes remain unverified. Owner relay resources/secrets are not provisioned here.
