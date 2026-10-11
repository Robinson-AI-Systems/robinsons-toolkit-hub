# Design — Batch D: Direct doors — `rtool` CLI, code SDK, local MCP, GitHub relay

Status: **APPROVED** (Chris, 2026-10-10). Scope and acceptance: `docs/PLAN.md` → Batch D. Cards D-1 … D-4.
Depends on K-2 (the reference fake server for tests). Origin: the Stripe MCP's first Batch R (archived there in
`docs/archive/batch-r-v1/BATCH-R.md`), generalized to every server.

**Why first:** Chris will use each toolset on its own long before the hub exists. These doors make any single RTC server
usable by any agent, wherever it runs, **without the hub**. When the hub exists (Batch H) it is simply one more target.

The deciding fact is network access: most cloud agent workspaces (Claude's workspace, Claude Code on the web, Codex
cloud, GitHub's coding agent, CI) allow only GitHub and package registries. That is why Chris's small GitHub push/pull
tool worked there.

| Where the agent runs | Door |
|---|---|
| claude.ai / Claude apps | each server's own connector |
| Cloud agent workspaces (GitHub + registries only) | `rtool` over the **GitHub relay** |
| Local machines (Claude Code, Codex CLI, Cursor, Claude Desktop) | `rtool mcp` (local MCP) or `rtool` direct |
| General sandboxes (Vercel Sandbox, E2B, Docker, VPS) | `rtool` direct |
| HTTP-only agents (custom GPT actions, n8n) | each server's HTTPS tool API + OpenAPI |

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| D1 | The reference fake server exists (K-2) | `ls packages/conformance/fake-server` |
| D2 | GitHub issue comments can be created, listed and deleted with a token scoped to one repository | GitHub REST docs "Issue comments" and fine-grained token permissions; record names in the PR |
| D3 | The relay repository exists and is private (IN-03) | `gh api repos/Robinson-AI-Systems/robinsons-toolkit-relay --jq .private` |

## 1. Decisions

**D1. `rtool` knows several servers.** Config (`~/.config/rtool/servers.json` locally; environment variables in sandboxes:
`RTOOL_SERVERS='stripe=https://…,workspace=https://…'` and `RTOOL_PASS_<NAME>`) maps a short name to a server URL and pass.
Local machines keep passes in the OS keychain (`rtool login <name>`). Tools are addressed by their full name, which
always starts with the server's prefix (contract §3), so the prefix picks the server (`rtool call stripe_customer_find
--args '{…}'`); `<server>.<tool>` (`stripe.stripe_customer_find`) is also accepted when two configured servers share a
prefix (for example a test and a production deployment of the same server).

**D2. Commands:** `init` (detect environment, write the agent's skill / `AGENTS.md` section, report the route per server),
`login`, `servers`, `whoami [server]`, `tools [server] [words]`, `describe <server.tool>`, `call <server.tool>`
(`--args`, `--fields`, `--detail`, `--out file` prints a one-line summary and keeps the full result in the file,
`--dry-run`, `--confirm`), `batch`, `result <server> <handle>`, `sdk [server]` (typed functions per area for code mode),
`mcp` (local stdio MCP over all configured servers, compact listing, names prefixed by server), `skill`,
`new-server` (K-4). Exit codes: 0 ok, 2 needs confirm, 3 refused by a guard, 4 service error, 5 pass expired/revoked,
6 no route. Plain JS, Node 24.x, no build step; installed with `npm install -g github:Robinson-AI-Systems/robinsons-toolkit-hub#cli-v1`
or `npx -y github:…#cli-v1 <cmd>`.

**D3. Route finding per server:** direct HTTPS first; on proxy refusal or connection failure, the GitHub relay; say which
once. Respect `HTTPS_PROXY` and the system certificate bundle.

**D4. The relay** is a small service in this repo (`api/relay/github.js`, deployed on Vercel with its own Neon table for
replay protection), independent of the hub server, serving every RTC server:
- Private repo `Robinson-AI-Systems/robinsons-toolkit-relay`; one issue per (agent, server) pair.
- The relay has an X25519 key pair; its public key ships with `rtool`. The CLI seals each request (server name, tool,
  args, **and the pass**) to the relay's public key, with a fresh symmetric reply key inside; GitHub only ever sees
  ciphertext. The relay decrypts in memory, calls the server's HTTPS tool API with the pass, encrypts the result with the
  reply key, posts it, and forgets everything. The CLI polls, decrypts, prints and deletes both comments.
- Signed GitHub webhooks only; `relay_seen(request_id)` stops replays; hourly cleanup deletes comments older than one
  hour. Issues, not commits — nothing enters git history.
- The relay holds no passes and no service keys at rest. Its private key is a Vercel secret Chris sets (IN-04).
- The agent's GitHub token needs access to the relay repository only.

**D5. Code mode:** `rtool sdk stripe` writes `rtool-sdk/stripe/<area>.js` with typed functions; writes still need
`confirm: true` and a pass that allows writes; money limits are enforced by the server, so a runaway loop is stopped
server-side.

## 2. Schema (relay only)

```sql
CREATE TABLE IF NOT EXISTS relay_seen (request_id TEXT PRIMARY KEY, seen_at TIMESTAMPTZ NOT NULL DEFAULT now());
```

## 4. Work units

### D-1 — `rtool` CLI, multi-server config, SDK, skill, init (L, medium effort)
Tests against the reference fake server: every command and exit code; `--out` prints one line; SDK compiles
(`tsc --noEmit` on the generated `.d.ts`) and a sample script runs; write-contract checks through the CLI.
### D-2 — `rtool mcp` local MCP (M)
Tests: MCP client smoke test over two fake servers (list, call a read, call a write without confirm → needs confirmation);
compact listing under 5,000 tokens for two servers.
### D-3 — GitHub relay (L, medium effort)
Tests with a fake GitHub API: round trip; comment bodies are ciphertext and contain no pass; both comments deleted; bad
webhook signature ignored; replay refused; revoked pass refused by the server and reported as exit 5.
### D-4 — Agent setup recipes and real runs (M)
Files: `docs/AGENT-SETUP.md` (Claude Code local/web, Claude's workspace, Codex CLI/cloud, Cursor, Copilot coding agent,
GitHub Actions, Vercel Sandbox with an allow-list, Docker; plus a paste-in paragraph), `scripts/agent-check.mjs`.
Done when: `agent-check` is green against the Stripe MCP or Workspace MCP (whichever has its HTTPS API first) from a
local machine (direct), a GitHub-only cloud workspace (relay) and a Vercel Sandbox (direct); passes revoked afterwards.

## 5. Stop-and-ask points
1. D2 false: amend the relay to a GitHub App installed on the relay repo only.
2. No server has its HTTPS API yet when D-4 is reached: finish D-4's docs, mark the real runs WAITING in STATUS.

## 6. Acceptance mapping

| PLAN Batch D line | Evidence |
|---|---|
| Any single server usable without the hub | D-4 real runs |
| Relay sees ciphertext only on GitHub | D-3 tests |
| Same guards through every door | write-contract through CLI, local MCP, relay |

## Amendments

**2026-10-11 — D-1 split into D-1a and D-1 (implementation pacing).** D-1a owns
the full direct HTTPS command surface, environment config, prefix routing, safe result handling
and direct write-contract tests. D-1 retains OS keychain login, SDK generation, agent skill,
init, final combined door verification and cli-v1 tag. This avoids crossing the hard ~800
production-line limit while keeping coherent, tested PRs. No acceptance is dropped.

**2026-10-11 — D-1b SDK and setup separated from secure login.** D-1a established
direct commands. D-1b adds SDK generation with TypeScript declaration files and real
HTTP execution, plus safe skill/init management of agent instructions. The remaining
D-1 card owns secure OS keychain login, declaration compiler gate, all-command
verification and immutable cli-v1 tag. No acceptance is dropped; user-approved
~500-line production PR target applies without padding unrelated security code.

**2026-10-11 — D-1c split for native credentials.** Linux/macOS/Windows keychain access
is independently reviewed as an authorization boundary. D-1 retains the TypeScript
SDK compiler check, all-door acceptance and cli-v1 tag. Actual device smoke checks
must not be confused with CI mocks of the native adapter invocation plans.

**2026-10-11 — D-2 compact MCP tool design clarification.** The local stdio
door presents six tiny alias-prefixed broker tools per configured authorized
server instead of every provider schema, preserving the original cheap-discovery
intent. A broker call forwards unmodified tool arguments/confirmation to that
server's HTTPS door and must not implement a shadow authorization policy.
Use the published 2025-11-25 MCP stdio JSON-RPC framing and never write
non-protocol output to stdout.

**2026-10-11 — D-3 split into D-3a and D-3.** The client-side authenticated
X25519 relay envelope and GitHub ciphertext-only issue comment transport
are isolated as D-3a. D-3 completes the signed webhook server, atomic
database replay resistance, forwarding, reply encryption, cleanup and CLI
fallback wiring. Relay repo creation, keys and production deployment are
owner gates and do not justify unsafe or placeholder code.

**2026-10-11 — D-3b server boundary split.** D-3b owns raw signed webhook
verification, configured private repository/issue/actor/server bindings, atomic
Postgres replay protection, HTTPS forwarding and the Vercel handler. D-3 retains
CLI route fallback, scheduled ciphertext cleanup and deployment instructions.
Bindings narrow reach to explicit owner configuration; no public deployment or
real credentials are authorized by this split. No acceptance is removed.

**2026-10-11 — D-3 route and cleanup details.** The reserved `rtc.http` sealed
envelope carries exact RTC paths to support discovery/batch/results without any
caller-selected server URL. POST fallback requires proved pre-connect failure;
ambiguous writes never repeat. Until owner keys exist, clients supply the public
key through public environment configuration. The hourly GitHub scheduler stays
inert until the owner configures its URL and separate bearer; no paid Vercel cron
is provisioned. Live routes remain D-4 owner-gated acceptance.
