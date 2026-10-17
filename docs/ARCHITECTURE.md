# ARCHITECTURE — runtime facts, as built

## H-4 owner-selected user delegation — source only, October 17

The owner-only `/api/owner/passes` flow now supports explicit selected
read_only/everyday/full Hub profile, TEST or LIVE mode and a separate
I_AUTHORIZE confirmation to enable writes on a **new** Hub pass. Read-only
TEST remains the default. Each pass is still issued once and independently
scoped to selected registered services. Existing passes are unchanged.

Owner-only `/api/owner/grants` separately stages an independently issued RTC
provider pass with owner-selected exact profile, mode and areas; the original
credential is AES-GCM sealed with caller/service/profile/mode AAD.
`/api/owner/verify-grant` makes the existing TLS/DNS-pinned public-contract
and credential-specific whoami reads; activation requires matching issuer
identity and actual write permission. Migration `023-hub-user-delegated-grants.sql`
replaces only the old fixed TEST/read_only CHECK constraints with the RTC
profile/mode enums. It does not modify past grant rows or authorize a provider
operation. New `resolveDelegatedWriteGrant` exists for a future separate
write-adapter; it reauthorizes the exact active Hub pass/provider grant from
current SQL and ignores any stale in-memory actor escalation.

**Non-serving boundary:** no write-capable provider call is exposed by the
existing MCP/HTTPS read broker yet; the existing Hub OAuth actor still has no
delegated-write support. C-1 remains draft pending a service-owned guarded
write adapter and native/HTTPS integration. A hosted migration/release is
independently gated; development-only spending/production restrictions
remain applicable to agents building this system.

## Current Workspace integration acceptance — October 17, 2026 UTC

D-4 is complete for the independent Workspace RTC service: original separate local direct, GitHub-only encrypted relay and Vercel Sandbox direct runners passed; native audited Hub read, TEST/read-only refusal, same-pass issuer revocation and all temporary cleanup are verified. See [D-4](pr-cards/D-4.md) and [the exact sanitized receipt](audits/2026-10-17-d4-final-route-acceptance.json). Other Hub fleet/service, optional core publication and remaining roadmap obligations stay separately open in STATUS; this does not declare the whole Hub project complete.

The temporary relay is now disabled: webhook inactive, routing maps empty, issue closed/zero comments, disposable passes/token and ingress bypass revoked, Sandbox stopped. Existing hosted credentials and useful standing Hub grant are preserved. Activation for a new agent/service needs its own approved binding and scoped credentials; never reuse revoked test material. Workspace remains fully standalone and does not discover Hub.


## Current source and acceptance boundary — 2026-10-14

The hosted Hub (`packages/hub`) includes H-1 identity/OAuth/pass foundations,
H-2 registry and grant source modules, and H-3 federation, bounded discovery,
cursor pagination and encrypted result source modules. The earlier statement
that H-2/H-3 had no implementation is superseded by these modules and their
tests; it is not a reason to rebuild them. Their exact current progress and
remaining requirements are recorded in STATUS/cards, not inferred from existence.
Source modules and synthetic 2/5/12/50/100-service tests do not prove hosted
migrations, real provider authorization, RTC certification, route/revocation or
cleanup acceptance. Independently reconcile main/live/READY production and run
cleared queue tasks before claiming those layers. The Hub is provider-agnostic;
each new custom server owns its provider capabilities and legacy coverage.
Existing local stdio MCP routes over RTC HTTPS but lists six meta-tools per
configured credentialed service; it is not accepted as a constant-size universal gateway.
The private core has eleven candidate exports and extensive tests; it is not required by existing direct routing.
See [the verified source review](audits/2026-10-12-gateway-architecture-recovery.md) for exact snapshots,
result-size and fan-out gaps, ownership and target constraints. Those target constraints are planned, not deployed.

Updated in the same PR that ships behavior. Designs describe what is planned.

As of 2026-10-11 (#86): **foundation, conformance, direct doors and encrypted relay code exist.** The owner approved and provisioned a separate private relay-transport GitHub repository, a minimally sized Neon database with verified replay migration, and a Vercel production-target build READY from the hub source repository. Vercel has production-only secret variables and an owner-entered repo token, but it is still protected and not functionally connected: webhook, RTC server mapping, agent bindings, permission check, test passes and three real route proofs remain open (IN-04/D-4). Existing custom servers' `/api/mcp` does not certify RTC adoption. See `docs/RELAY-DEPLOY.md` and D-4 card.

## Built in K-3n (PR #35)

`scripts/core-artifact-evidence.mjs` creates an offline temporary package, validates its exact vetted files and archive size/hash, reports SHA256, and deletes the candidate. This is pre-release integrity proof only: the package stays private and **no GitHub Release exists**. `docs/adoption/` contains proposed Stripe and Workspace steps; implementation in those standalone service repositories remains gated.

## Built in K-3m (PR #34)

Source-to-core provenance is pinned in `docs/audits/K3-SOURCE-TRACE.json`. An offline `npm run check` verifier computes Git blob hashes of all public modules, validates mapped tests and the five identical/six adapted dispositions, and intentionally refuses a premature released status. No runtime, service route or production capability changes.

## Built in K-3l (PR #33)

The database suite now validates the core adapter contracts against throwaway Postgres with independent connection pools: single-use encrypted secrets, shared fifteen-minute login lockouts, and connection-scoped results. It never creates service migrations or provisions external infrastructure. Source servers must separately adopt and verify their own storage implementations.

## Built in K-3k (PR #32)

Core distribution policy is now checked in every `npm run check`: explicit export/file closure, ESM-only source, private package, no external runtime dependencies, no source symlinks, no install scripts or dynamic import. Failing fixtures demonstrate enforcement. Not a release workflow and does not certify source behavior or production adoption.

## Built in K-3j (PR #31)

Cross-boundary offline tests compose core OAuth issue/refresh, MCP bearer projection, guarded dispatch, independent server-owned money preflight and scoped oversized result persistence. Tests use an isolated in-memory service fixture and make no claim of SQL, live adoption or published release. K-3 remains private and unfinished.

## Built in K-3d (PR #25)

`packages/core/test/consumer.test.js` uses offline `npm pack` and a
separate temporary npm install to exercise the exact public package exports.
The package remains `private: true` and bundles only six vetted leaf modules
plus package.json. Service-owned handlers are not exported, and imports require
no SDK, provider client, secret or live HTTP request. This is clean-consumer
proof for the **partial** package, not completion of K-3 or a Release asset.

## Built in K-3c (PR #24)

`packages/core/src/profiles.js` retains only Stripe's portable
`CONNECTION_PROFILES`, `isToolAllowed`, `visibleTools`, `profileCounts` and
`publicToolInfo` functions (same function bodies); Stripe's guarded test-area,
account and listing policy stays service-owned. `write-contract-check.js` is
source-identical optional declaration validation for `defineWrite-v1` metadata.
Neither helper executes a write, approves money, or replaces DB-backed guards.
The server keeps independent approval and limit enforcement.

## Built in K-3b (PR #23)

Source-identical Stripe `src/core/registry.js` and `http.js` are now private
core subpath exports. Registry retains duplicate-name/missing-handler rejection;
HTTP retains explicitly configured HTTPS issuer, no-cache/nosniff response,
body parsing and method allowlist. Core has no provider SDK dependency.
Tests exercise both before/after output and refusal side effects with captured
response objects. No service adoption or public release is claimed.

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
| Real-run acceptance | docs/pr-cards/D-4.md | Workspace three-route, same-pass revocation and cleanup PASSED; other fleet services remain separate. |

This is verification infrastructure, not certification of any real hosted route.

## Built in D-3 (PR #19)

| What | Where | Notes |
|---|---|---|
| Relay HTTP door | packages/relay/src/routes.js | Reserved rtc.http envelope allows exact manifest/whoami/tools/batch/results paths and bounded query fields only; no arbitrary URLs. |
| CLI routing | packages/cli/src/relay-route.js; http.js; dispatch.js | Direct first, fallback on reads or proved pre-connect POST failure; server refusals and ambiguous writes never retried; server passes stay in encrypted envelope. |
| Ciphertext cleanup | api/relay/cleanup.js; packages/relay/src/cleanup.js | Separate bearer, configured private-repo issues, ciphertext older than one hour, explicit bounded/failure handling; prune old seen IDs after comment cleanup. |
| Hourly scheduler | .github/workflows/relay-cleanup.yml | Inert until owner supplies URL variable and cleanup bearer secret. No GitHub token permissions; no paid Vercel cron configured. |
| Setup | docs/RELAY-DEPLOY.md | IN-02 and repo creation portion of IN-03 fulfilled; IN-04 partly configured. Vercel build READY but no webhook/RTC live smoke claim. Generated standalone SDK bundles the relay-capable runtime; passes remain environment-only. |

Client env: `RTOOL_RELAY` (public repo/key/alias→issue JSON),
`RTOOL_RELAY_TOKEN` (private agent one-repo token), plus the normal server pass.
`RELAY_CLEANUP_SECRET` is a separate hosted/scheduler bearer. Scheduler timing is
best effort; its failure is visible in Actions. Some protected Vercel production variables exist, but scheduler, GitHub webhook, relay server/agent bindings and real passes remain disabled.

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
Deployment and replay migration are provisioned. Actual Workspace signed webhook, immutable binding, original encrypted relay read and D-4 revocation/cleanup are verified; temporary routing is disabled after cleanup. Persistent scheduling and other agent/service activations remain separately owner-scoped.

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

Real device smoke for native credentials remains unverified. Hosted infrastructure and actual Workspace D-4 direct/relay/Sandbox/revocation are accepted; temporary relay infrastructure is disabled after cleanup. Other service fleet and native OS-vault proof remain separate.

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
| CI | `.github/workflows/ci.yml` | Jobs `check`, `unit`, `db` (official Postgres 17 service), aggregate `ci` (merge gate). `permissions: contents: read`, no secrets, no `pull_request_target`; guarded by `tests/unit/ci-workflow.test.js`. |

## Historical planning baseline (superseded by current STATUS and work index)

This original baseline is retained for chronology. Current source includes private core work, hosted Hub foundations and local tools; their incomplete acceptance remains in STATUS/work-index. Workspace D-4 real routes and cleanup are complete, while native OS credential smoke and other fleet obligations remain separate. Owner relay resources were provisioned; temporary activation is now cleaned.

## H-1 hosted partial gateway (PR #134 proposed)
Hosted Node entrypoints `api/mcp.js` (OAuth-only, fixed two functional tools), `api/whoami.js` (Hub pass only), `api/oauth/token.js` (pre-authorized PKCE exchange and refresh), and `api/contract.js` (RTC 0 until full conformance). Runtime requires separately provisioned `HUB_DATABASE_URL` and `HUB_TOKEN_PEPPER`, uses small PostgreSQL pool and shared SQL rate counters. Owner consent, HTTPS API completeness, H-2 upstream grants, H-3 federation and actual deployed tests are incomplete; no client-facing ability to issue an owner's OAuth code is exposed. Scheduled-only live deployment policy unchanged.

## H-1 verified-owner OAuth entry (PR #135 proposed)
`api/oauth/clients.js` registers exact client redirects after scrypt-verified owner login and database 5/15-minute lockout. `api/oauth/authorize.js` allows only an owner-verified, client-registered, PKCE S256, TEST read_only code; the subsequent token route rotates credentials and persists scopes. Public OAuth metadata under `/.well-known/` rewrites uses only separately pinned `HUB_PUBLIC_ORIGIN`. Provision `HUB_OWNER_ID`, `HUB_OWNER_SCRYPT`, `HUB_PUBLIC_ORIGIN`, `HUB_DATABASE_URL`, `HUB_TOKEN_PEPPER` outside Git, use migrations 001/002, and never log or commit passwords, tokens or hashes. The locally implemented source does **not** prove actual owner host credentials/connected MCP, RTC 1 conformance, registration compatibility or deployed provider tests. Production promotion remains only the scheduled checked live workflow.
