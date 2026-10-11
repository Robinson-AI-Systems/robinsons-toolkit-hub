# Use one Robinson Tool Contract server from any agent

The server stays standalone; no hub is needed. CLI, SDK, local MCP and encrypted
relay code are built and tested against throwaway services. Real D-4 direct/relay/
sandbox runs are **WAITING**, not certified. See D-4 card and OWNER-INPUTS IN-02/03/04.

## Install and configure once

Use Node 24. Clone a reviewed main commit, then `npm ci`. For global CLI use
`npm install -g github:Robinson-AI-Systems/robinsons-toolkit-hub#REVIEWED_MAIN_SHA`
with the actual reviewed commit from STATUS/handoff. The immutable `cli-v1` tag
predates the relay; do not use it to test new relay code. Do not silently update
an already certified agent without repeating route verification.

Set `RTOOL_SERVERS` to comma-separated `alias=https://server-origin` mappings.
Passes never go into servers.json, AGENTS.md, argv, URLs or code. Locally use
`rtool login ALIAS` (hidden input and OS keychain); in a sandbox use its protected
secret environment with `RTOOL_PASS_ALIAS`. Missing credentials isolate that alias.
For proxy-managed environments use the Node 24 environment-proxy option supported
by the installed Node release; configure trusted certificates using the approved
system certificate bundle. Never disable TLS verification.

Discover with `rtool servers`, `rtool whoami ALIAS`, `rtool tools ALIAS WORDS`,
then `rtool describe ALIAS.PREFIX_TOOL`. Select tools from actual metadata; never
invent a name. Reads: `rtool call ALIAS.PREFIX_TOOL --args JSON`.
Writes: preview with `--dry-run`, review what changes, then supply `--confirm`
only with the required permission/independent owner approval. A confirmation flag
never substitutes for a money-out approval required by the standalone server.
Use `--out NEW_FILE` for large results. Never repeat an uncertain write blindly.

## Choose the environment's door

| Environment | Setup and door | Verification expectation |
|---|---|---|
| Claude Code local | Install CLI, keychain login, `rtool init --out PROJECT_DIRECTORY`; use direct CLI or `rtool mcp` in its local MCP configuration | direct |
| Claude Code web | Protected environment passes; scoped GitHub repo token/public relay config; use CLI/SDK; relay only when direct is blocked | relay in a GitHub-only workspace |
| Claude workspace | Install CLI with supported package access; configure protected env and one-repo relay access; paste the guidance below | relay in a GitHub-only workspace |
| Codex CLI | Node 24 + CLI, keychain or secret env; run init in the actual project; direct CLI or local MCP | direct |
| Codex cloud | Protected pass env; if server origin is allowed, direct; otherwise private relay issue/token/key; no broad repo token | direct or relay, as actually configured |
| Cursor | CLI/SDK from project terminal, or local stdio MCP command `rtool mcp` with environment/keychain available | direct |
| Copilot coding agent | Repository agent instructions from init; protected environment passed by authorized setup; private relay where HTTPS is denied | relay in a GitHub-only workspace |
| GitHub Actions | Node 24, pinned CLI/source; owner-scoped pass and relay token in repository/environment secrets; never echo them; use read-only verification in an explicitly authorized manual run | direct or relay, according to runner allowlist |
| Vercel Sandbox with allow-list | Node 24; allow exact RTC origin for direct; inject pass privately; allow GitHub API only if approved relay route is needed | direct for the D-4 sandbox proof |
| Docker | Node 24 image; install pinned CLI; inject env secrets at runtime or approved native vault; direct CLI/MCP; do not bake passes into image layers | direct |

For local MCP clients use the installed absolute rtool executable and argument
`mcp`; protocol is newline-delimited JSON-RPC stdio. Diagnostics go to stderr.
The server catalog is compact and alias-prefixed. `rtool sdk ALIAS --out NEW_DIR`
exports typed ES modules plus a self-contained direct/relay runtime; it reads
passes from env at invocation. Never put a pass in generated source.

Relay setup is in [RELAY-DEPLOY.md](RELAY-DEPLOY.md). Public `RTOOL_RELAY`
configuration contains repository/public key/server issue mapping; private
`RTOOL_RELAY_TOKEN` is one-repo Issues read/write. The owner-created hosted relay
must be deployed and configured first. No host or default key is fabricated.

## Verify a real route only after owner authorization

Use a short-lived **read_only** test pass for the chosen server's non-production
account. Obtain actual read-tool metadata and choose a harmless read operation.
Give its required input through a named protected args environment variable.
Never use an existing production pass or infer authorization from this document.

From a checkout of the same reviewed commit, run:

```bash
node scripts/agent-check.mjs --server ALIAS --read-tool PREFIX_READ_TOOL --pass-env TEST_PASS_ENV_NAME --args-env TEST_ARGS_ENV_NAME --expect-route direct --authorized-real-run
```

The symbolic names above must be replaced with real metadata/env **names**, never
secret values. Omit `--args-env` for a no-argument read. Use `--expect-route relay`
only in the actual GitHub-only workspace. Default without `--authorized-real-run`
permits localhost only; the flag does not grant owner authorization by itself.
Exit 0 means that invocation's manifest, read-only identity, metadata and actual
read/result-route checks passed. Exit 1 is verification failure; exit 2 is usage.
Only check names, route and neutral failure code are printed; no result/pass/args.

D-4 evidence must name the reviewed commit, environment, expected/observed route,
UTC date, runner exit and pass-revocation confirmation. Keep account/credential
values private. Complete all three routes: local direct, GitHub-only relay and
Vercel Sandbox direct. Revoke every test pass/token after the runs even on failure;
local `rtool logout` alone deletes the local entry and does not revoke server access.
Record failures as failures, not certified or silently skipped checks.

## Paste into an agent's project instructions

> Use the configured Robinson RTC server through rtool. Search and describe actual
> tools before calling. Preview writes; obtain required approval before confirmation.
> Keep passes/tokens in the protected environment or native vault, never in this
> file or logs. Use --out for large results. The remote service is the guard authority.
> Direct HTTPS is tried first, with an owner-configured encrypted GitHub relay for
> blocked routes. Never automatically repeat an ambiguous write. Report real
> results and failed checks honestly; do not invent deployment or verification.

## Current evidence

Local fake tests prove CLI/SDK/stdio MCP guard behavior and encrypted signed relay
round trips. D-4a adds actual local read-only runner tests. They do not prove access
from any real agent product, a hosted relay, a real OS vault or a real service.
Those runs remain owner-gated in [pr-cards/D-4.md](pr-cards/D-4.md).
