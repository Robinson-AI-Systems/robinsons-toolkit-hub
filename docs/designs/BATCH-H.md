# Design — Batch H: The hub server (one front door to every server)

Status: **APPROVED** (Chris, 2026-10-10). Scope and acceptance: `docs/PLAN.md` → Batch H. Cards H-1 … H-5.
Depends on K-3 (`robinson-mcp-core`) and D-1. Long-term: built after at least two servers pass conformance.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| H1 | `robinson-mcp-core` is released and pinned | `packages/core/package.json` version; Release exists |
| H2 | At least two servers pass RTC conformance | each server's CI `conformance` job |

## 1. Decisions

**H1. The hub is itself an RTC 1 server** (built on `robinson-mcp-core`): its own connector login (settings survive
refresh and rate limits live in its database, contract §2), passes, HTTPS API,
manifest and meta-tools. So every agent door (connector, HTTPS, `rtool`, local MCP, relay) works with it unchanged.

**H2. Backends are registered, not built in.** `hub_servers` holds each server's name, URL, RTC version (from
`GET /api/contract`) and the hub's pass for it, stored encrypted (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`), added only on the
hub's setup page (never in chat). A server pass for the hub is created by Chris on that server, marked "for Robinson's
Toolkit".

**H3. Federated tools.** `hub_search_tools(query, server?)` fans out to each server's search and merges results (ranked,
server-labelled); `hub_describe_tool(server.tool)`, `hub_call(server.tool, args)`, `hub_batch` route to the server's
HTTPS API. The hub never duplicates a server's guards; it passes through `dryRun`/`confirm` and returns the server's
result as-is, plus its own `server` label.

**H4. Hub profiles and passes.** A hub connection or pass chooses which servers and which server-profiles it may reach;
the hub can only narrow what its stored server pass allows, never widen it.

**H5. Hub change log** records every routed call (connection, server, tool, summary, the server's change-log id);
`hub_recent_changes` reads the hub's log and, on request, each server's. `hub_health` shows each server's status,
RTC version and tool counts.

**H6. Listing:** compact by default (hub meta-tools + workflows from Batch C), under 5,000 tokens however many servers
are registered.

## 2. Schema

```sql
CREATE TABLE IF NOT EXISTS hub_servers (name TEXT PRIMARY KEY, url TEXT NOT NULL, rtc INTEGER, pass_enc TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(), checked_at TIMESTAMPTZ, status TEXT, counts JSONB);
CREATE TABLE IF NOT EXISTS hub_change_log (id BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now(),
  connection TEXT, server TEXT NOT NULL, tool TEXT NOT NULL, summary TEXT, server_log_id TEXT, dry_run BOOLEAN NOT NULL DEFAULT FALSE);
```

## 4. Work units
### H-1 — Hub foundation on `robinson-mcp-core` (M)
### H-2 — Server registry, setup page, health (M, medium effort)
### H-3 — Federated search, describe, call, batch (L, medium effort)
Tests: two fake servers; merged search; call routing; `dryRun`/`confirm` pass-through; a server's refusal returned intact.
### H-4 — Hub profiles and passes that can only narrow (M, medium effort)
### H-5 — Hub change log and recent changes (S)

## 5. Stop-and-ask points
1. A server cannot give the hub a pass narrow enough for a requested hub profile: refuse; never widen.

## 6. Acceptance mapping

| PLAN Batch H line | Evidence |
|---|---|
| Hub passes RTC conformance itself | CI conformance job |
| Hub never widens a server pass | `packages/hub/test/narrowing.test.js` |
| Compact listing stays small with many servers | budget test with 5 fake servers |

## Amendments
