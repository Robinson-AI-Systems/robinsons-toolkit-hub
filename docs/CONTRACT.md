# The Robinson Tool Contract (RTC) — version 1

The rules every Robinson service server follows (Google Workspace MCP, Stripe MCP, and every future server: Vercel,
Neon, GitHub, …) so that **Robinson's Toolkit** (the hub, this repo) can combine them without reimplementing them, and so
any AI agent gets the same behavior from every server, directly or through the hub.

This file is the single authority for the contract. Servers cite its version (`RTC 1`) in their own plans. A change to
the contract is a new version with a dated entry in `docs/DECISIONS.md`; servers move to it with their own card.
The conformance test (`packages/conformance`, card K-2) checks a server against this file.

Words: **server** = one service server (e.g. `stripe-mcp`). **Hub** = Robinson's Toolkit. **Agent** = any AI client.
**Pass** = a short-lived bearer token a person creates for an agent or for the hub.

## 1. Doors every server provides

| Door | Path | Who uses it |
|---|---|---|
| MCP connector | `POST /api/mcp` (Streamable HTTP), OAuth 2.1 + PKCE login at `/api/oauth/*` with discovery at `/.well-known/*` | claude.ai and other MCP clients |
| HTTPS tool API | `GET /api/tools?q&area&limit`, `GET /api/tools/{name}`, `POST /api/tools/{name}`, `POST /api/tools/_batch`, `GET /api/results/{handle}`, `GET /api/whoami` | The hub, HTTP-only agents, the `rtool` CLI |
| Contract manifest | `GET /api/contract` → `{ rtc: 1, server, version, apiVersion?, areas[], counts: { tools, writes, money }, profiles[], listingModes[], modes[] (e.g. `test`, `live` or `preview`, `production`), devTools: boolean }` (no auth) | The hub, the conformance test |

The CLI, the GitHub relay, the code SDK and local MCP are **hub** doors (built once in this repo), not server doors.

## 2. Authentication

- **Connector tokens** come from the server's OAuth login (passphrase page with lockout: 5 wrong tries in 15 minutes per
  address). Stored hashed. **A refresh keeps every connection setting** (account, mode, profile, listing, areas): the
  settings are stored on the authorization code and the token row, and the refresh copies them from the issuing row —
  it never falls back to defaults, so a read-only or test connection stays read-only or test.
- **Passes** (`kind = 'pass'`) are created only by a person — through a confirmed server tool
  (`<prefix>_create_pass`) or the server's setup page — and shown **once** on the server's one-time-secret page, never in
  chat. Each pass carries: profile, allowed areas, `allow_writes` (default false), live/production access where the server
  has such a concept (default off), money limit where money exists (default $0), expiry (default 24 h, max 30 days; the
  hub's own pass may be longer, see §8). Listed with the server's connections tool and revocable instantly.
- The HTTPS tool API accepts passes only (`Authorization: Bearer <pass>`); the MCP door accepts connector tokens.
- **Rate limits are shared across instances.** Servers run on serverless hosts where each instance has its own memory, so
  a per-pass or per-address limit (including the login lockout) is counted in the server's database with one atomic
  update, never in memory. Over the limit → HTTP 429 with `Retry-After` and code `rate_limited` (§7).
- No server ever accepts a service credential (API key, OAuth secret) as a tool argument, and never returns one.

## 3. Tool shape

Every tool has: `name` (`<area>_<verb>_<object>`, snake_case; workflows `workflow_*`; server-about-itself
`<prefix>_*`), `description` (listing text ≤160 characters, starting with the action; `MOVES MONEY:` first when it
does), `inputSchema`, and metadata: `area`, `profiles` (`read_only` | `everyday` | `full`), `writes` (boolean),
`money` (boolean), `destructive` (boolean), `audience` (one or more of `builder` — building or testing something with
the service; `owner` — setting up and administering an account; `operator` — day-to-day use), and MCP `annotations`
(`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) consistent with that metadata. Search accepts an
`audience` filter.

## 4. Meta-tools every server provides

`<prefix>_search_tools(query, area?, limit=10)`, `<prefix>_describe_tool(name)`, `<prefix>_call(name, args)`,
`<prefix>_batch(calls[≤10], reads only)`, `<prefix>_get_result(handle, page?, fields?)`, `<prefix>_whoami`.
`_call` dispatches through the same wrapped handler as a direct call: **no door may skip a guard**.

## 5. Listing modes

`catalog` (all tools in the profile; for clients with tool search) and `compact` (meta-tools, whoami, workflows, and the
server's universal tools if any; under 5,000 tokens). Chosen per connection or pass; overridable with `?listing=`.

## 6. Writes: preview, confirm, read-back, change log

- Every write tool accepts `dryRun: true` → says exactly what would change, changes nothing, logs a preview.
- Destructive, money-moving, production/live, or permission-widening writes require `confirm: true`; without it the
  result is `{ done: false, needsConfirmation: true, summary }` and nothing changes.
- After a write the server reads the service back and returns what it now holds, with
  `confirmed: true | false | null` (null = nothing could be read back; nothing claimed).
- Every write (and preview) writes a change-log row: when, which account/project, which connection or pass, tool,
  target, summary, before, after, idempotency key where the service supports one, and the inverse where one exists.
- Retries are safe: the server sends the service's idempotency key where the service supports one, or checks the change
  log for the same request key within 10 minutes where it does not.

## 7. Results and errors

- Result envelope for the HTTPS API: `{ ok: true, result, handle?, mode? }` or `{ ok: false, error: { what, cause,
  todo, technical, code } }`. The MCP door returns the same content as text plus `structuredContent` for workflows.
- Read tools accept `fields` (dotted paths) and `detail: 'summary' | 'full'` (default summary).
- A result over 8 KB returns the first part, a count, a one-line summary and a `handle` kept 24 hours for the same
  connection or pass only.
- Lists return one page (default 20, max 100) with `next`.
- Money in integer minor units plus a `_display` string; times as stored plus `_local` in the owner's time zone
  (`America/Denver` for Chris).
- Error codes (machine-readable `code`): `needs_confirmation`, `refused_by_guard`, `not_found`, `permission`,
  `service_error`, `rate_limited`, `pass_expired`, `pass_revoked`, `invalid_args`, `outside_scope`.

## 8. What the hub may assume

- `GET /api/contract` tells it the server's areas, counts and RTC version; it refuses servers with an unknown version.
- It can search, describe and call with a pass whose profile and areas the person chose; it never sees service keys.
- It records its own change-log entry for every call it routes, pointing at the server's change-log row (returned as
  `logged.id` in write results).
- The hub's pass for a server may be long-lived (up to 365 days) only if the person ticks that option; it is still
  revocable on the server.

## 9. Conformance

(§10 is checked only for servers whose manifest says `devTools: true`: a dev tool refuses live/production; cleanup
touches only recorded objects.)

(§11 is checked by: `_admin_overview` present and well-formed; `_where_is_setting` returns structured steps; account-wide
writes need `confirm`.)

A server is "RTC 1" when `packages/conformance` (run against its URL with a test pass in its test/sandbox mode) passes:
manifest; search/describe/call/batch/result; a read tool's `fields`/`detail`/handle behavior; a write tool's dryRun /
needs-confirmation / confirm / read-back / change-log behavior; refusal of writes by a read-only pass; expired and
revoked passes refused; a refreshed connector token keeps its settings; rate limits hold across two server instances
(two conformance clients hitting the limit together); no key-shaped strings in any response; listing budgets. Each server runs it in its own CI.

## 10. Developer conventions (SHOULD for every server; MUST once a server offers `devTools`)

These servers are general development tools. So that agents can build and test against any of them the same way —
and the hub can set up and tear down a whole development environment across servers — servers that offer developer
tools follow these conventions:

- **Safe modes.** Developer tools (`<prefix>_dev_*`) act only in the service's test, sandbox, preview or
  non-production mode, and refuse in live/production mode before reading anything. The manifest lists the modes.
- **Runs.** Anything a developer tool creates belongs to a **run**: the server records every created object's ID, and
  tags the object with `rtc_run=<runId>` where the service allows metadata, labels or properties. A caller may pass its
  own `runId` (the hub does, to tie one environment together across servers).
- **Cleanup.** `<prefix>_dev_cleanup(runId)` removes or archives exactly the recorded objects (preview first; `confirm`
  to act; trash rather than delete where the service has a trash) and reports per object.
- **Fixtures and scenarios.** `<prefix>_dev_seed(scenario | description)` creates realistic test material from named
  scenarios; previews list exactly what will be created.
- **Integration check.** `<prefix>_dev_check_integration(spec)` reports, without changing anything, whether the service
  is set up for an app being built (events, permissions, settings), with exact console steps for anything with no API.

## 11. Owner and administration conventions (MUST for every server)

These servers serve three audiences equally: a developer building for others, a developer building for themselves, and
the account owner or end user who needs their account set up and run. So every server covers the **owner side** of its
service, not only its developer API:

- **Admin overview.** `<prefix>_admin_overview` reads, in one call, the account's whole owner-side state: account and
  business details, verification or requirements due, team members and roles, security (two-step login, keys or tokens,
  SSO, audit log where available), the service's own plan, usage and bill, notification and email settings,
  integrations, and anything the service flags. Each item: `ok` / `needs_attention` (why) / `not_readable` (no API; see
  below).
- **Every owner setting is reachable.** Settings with an API get real tools (same write rules as §6). Settings with no
  API get a **guided setting**: `<prefix>_where_is_setting(query)` returns structured steps —
  `{ setting, url, steps: [{ n, action, target, value? }], expected, verifyWith?: { tool, args, field, equals } }` — so
  a person or an agent with a browser can do it, and the server then confirms it by reading back (`verifyWith`) when the
  service exposes the value. A guided setting is never reported as done unless verified or the person says so.
- **Dashboard map coverage.** Each server keeps a dashboard map (`src/data/dashboard-map.js`) covering every settings page
  of its service, checked against the service's current dashboard when the server's API version moves.
- **Account-wide changes are owner actions:** changing team roles, keys, security, plan or billing settings always needs
  `confirm` and appears in the change log, through any door.

