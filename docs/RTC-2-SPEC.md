# RTC 2 — Discovery & Connection Specification

**Status: ADOPTED — 2026-10-31, by the owner's dated decision recorded in
this repo's `docs/DECISIONS.md` ("2026-10-31 — RTC 2 adopted as RTC 1's §9
successor; the RTC 1 freeze holds"), with rulings D1–D5 recorded in §13.
This document binds the hub and the conformance suite from adoption; each
server adopts it through its own card (§12).**

Drafted from: the frozen RTC 1 contract (hub repo `docs/CONTRACT.md`, frozen
2026-10-11), the hub connection profile of 2026-10-18
(`docs/HUB-CONNECTION-SPEC.md`), the Workspace owner decision of 2026-10-19
(`docs/HUB-COMPATIBILITY.md`), the R-3 conformance judgment of 2026-10-31
(the drift dossier), the shipped dialects of the Vercel and Workspace doors,
and the RAS MCP Standard (Library D-001).

Words: **MUST** / **MUST NOT** are requirements a conformance probe can check.
**SHOULD** / **SHOULD NOT** are requirements a server may depart from only with
a written reason in its own docs. **MAY** is a genuine option. **Server** = one
service server (e.g. `vercel-mcp`). **Hub** = Robinson's Toolkit. **Person** =
the human who owns the accounts. **Pass** = a short-lived bearer token a person
creates for an agent or for the hub (RTC 1 §2).

---

## 1. Preamble

### 1.1 Purpose

RTC 1 froze a behavioral contract: the doors every server provides, the write
lifecycle, the pass model, the listing modes. What RTC 1 never pinned was the
**wire shape of discovery and connection** — how a hub finds a server, reads
its advertisement, gets authorized, enumerates its tools, and recovers large
results. On the two points where the text was silent (how listing pages
continue; what a result page contains), the conformance suite became the de
facto spec, and when the suite changed after the freeze, the "contract"
changed with it — while still calling itself RTC 1. Two production servers
built two different, honest readings of the same text.

RTC 2 exists to close exactly that hole. **This document is the spec. The
conformance suite is derived from it and is never normative (§11).**

### 1.2 The one-way doctrine

- The hub discovers servers and connects to them. **Servers never locate the
  hub.** A server MUST NOT initiate any connection, callback, registration
  ping, or heartbeat to a hub, and MUST NOT contain code whose purpose is to
  announce itself to one.
- A server makes itself connectable by **advertising**: publishing a truthful
  description of itself at well-known addresses on its own origin (§2). A
  person points a hub at the server's address; everything the hub needs to
  connect, it reads from the advertisement and the standard discovery chain.
- **Advertise, don't push.** No server-to-hub callbacks, no registration, no
  eager full-catalog expansion (§10).
- **Standalone guarantee.** Every server MUST work fully — direct MCP
  clients, direct HTTPS clients, its own connection page — with no hub in its
  life. The hub is one client among others, never a dependency.
- The hub initiates discovery, authorization, and selected tool calls. The
  **person** chooses the account, the profile, and the areas. Neither the hub
  nor the server may widen what the person chose.

### 1.3 Relationship to RTC 1

- RTC 2 **supersedes** RTC 1 on the discovery/connection surface: the
  advertisement (§2), version rules (§3), authorization sequences (§4),
  enumeration (§5), pagination (§6), result recovery (§7), and errors on
  those surfaces (§8).
- RTC 1's write lifecycle (preview → confirm → read-back → change log, RTC 1
  §6), tool shape (§3), pass format and safety rules (§2), developer
  conventions (§10), and owner/administration conventions (§11) **carry over
  unchanged** unless a section of this document says otherwise.
- RTC 1 remains frozen and remains a valid, hub-supported version until each
  server migrates by its own card (§11). RTC 2 does not retroactively make
  any RTC 1 server non-conforming.

---

## 2. The advertisement

### 2.1 `GET /api/contract` — the manifest

Every server MUST serve its manifest at `GET /api/contract` on its canonical
HTTPS origin, with **no authentication**, as `application/json`. A hub treats
a non-200 response as "server unavailable," never as a contract violation.

The response body MUST be exactly one JSON object with these fields:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `rtc` | integer | MUST | The highest RTC major version this server fully serves on this origin. RTC 2 servers send `2`. |
| `server` | string | MUST | Canonical unique server id (e.g. `vercel-mcp`). Stable across deployments of the same server; never reused by a different server. |
| `prefix` | string | MUST | The tool-name prefix, including trailing underscore (e.g. `vercel_`). Every tool name on every door starts with it. |
| `version` | string | MUST | The server's own software version (e.g. `0.5.0`). |
| `revision` | string | MUST | The deployed source revision (full or short git SHA) that is actually serving. A hub or auditor MUST be able to compare this against the server's repo; advertising a revision that is not the deployed one is a false advertisement (§10). |
| `apiVersion` | string | MAY | The server's own API revision marker, carried from RTC 1. |
| `areas` | string[] | MUST | The bounded list of tool areas the server exposes. |
| `counts` | object | MUST | `{ tools, writes, money }` — integer counts of all tools, write tools, and money tools in the full catalog. Counts MUST describe the deployment that serves the manifest. |
| `profiles` | string[] | MUST | Subset of `read_only`, `everyday`, `full` that the server offers. |
| `modes` | string[] | MUST | The server's modes (e.g. `preview`, `production`; `test`, `live`) where the concept exists; `[]` where it does not. |
| `listingModes` | string[] | MUST | Subset of `catalog`, `compact` that the server serves (§5). |
| `listing` | object | MUST | `{ pagination: "cursor", maxLimit: 100, replyBudgetBytes: 8192 }` — the pinned pagination dialect (§6) and budgets (§5). The values are fixed by this spec; the field exists so a hub never has to guess them. |
| `results` | object | MUST | `{ recovery: "content-pages", handleTtlSeconds: 86400, pageBudgetBytes: 8192 }` — the pinned result-recovery dialect (§7) and handle lifetime. Fixed by this spec; declared so it is checkable. |
| `auth` | object | MUST | `{ passes: true, oauth: null }` or `{ passes: true, oauth: { issuer, protectedResource } }`. `passes` MUST be `true` (§4.2). `oauth` MUST be `null` unless the server offers the OAuth transport (§4.3), in which case `issuer` is the authorization server's issuer URL and `protectedResource` is the exact MCP resource URL. |
| `connection` | string (URL) | MUST | The server's human connection page (§2.3) on the same origin. |
| `devTools` | boolean | MUST | Carried from RTC 1; gates the developer conventions. |
| `health` | string (path) | SHOULD | Path of the server's health endpoint (fleet health contract, RAS MCP Standard Stage 1), e.g. `/api/health`. |

Unknown fields MUST be ignored by hubs. A server MUST NOT add fields that
contradict the pinned values above; extensions belong in a namespaced
`x-<server>-…` field.

Worked example (abbreviated values are illustrative; the shape is normative):

```json
{
  "rtc": 2,
  "server": "vercel-mcp",
  "prefix": "vercel_",
  "version": "0.5.0",
  "revision": "71c3ce8",
  "areas": ["projects", "deployments", "env"],
  "counts": { "tools": 253, "writes": 61, "money": 4 },
  "profiles": ["read_only", "everyday", "full"],
  "modes": ["preview", "production"],
  "listingModes": ["catalog", "compact"],
  "listing": { "pagination": "cursor", "maxLimit": 100, "replyBudgetBytes": 8192 },
  "results": { "recovery": "content-pages", "handleTtlSeconds": 86400, "pageBudgetBytes": 8192 },
  "auth": { "passes": true, "oauth": { "issuer": "https://vercel.robinsonaisystems.com", "protectedResource": "https://vercel.robinsonaisystems.com/api/mcp" } },
  "connection": "https://vercel.robinsonaisystems.com/connection",
  "devTools": false,
  "health": "/api/health"
}
```

### 2.2 The discovery chain

For the OAuth transport, the server MUST serve, and a hub MUST use, the
standard chain — in this order, with no guessing of issuer or brand:

1. `GET /.well-known/oauth-protected-resource` (RFC 9728; the
   endpoint-specific variant for `/api/mcp` is acceptable): MUST return a
   `resource` exactly equal to the server's MCP endpoint URL and an
   `authorization_servers` array whose first entry is the issuer. The MCP
   door's `401` responses SHOULD carry `WWW-Authenticate` pointing at this
   metadata.
2. The issuer MUST serve authorization-server metadata (RFC 8414) or OIDC
   discovery at its well-known address, including `authorization_endpoint`,
   `token_endpoint`, `code_challenge_methods_supported` containing `S256`,
   and the client-onboarding method(s) it supports (RFC 7591 dynamic client
   registration and/or Client ID Metadata Documents).
3. The manifest's `auth.oauth` (§2.1) MUST agree with this chain. If they
   disagree, the chain wins and the manifest is defective.

For the pass transport, no discovery chain is needed: the person creates the
pass on the server itself (§4.2).

### 2.3 The human connection page

The URL in the manifest's `connection` field MUST serve a plain-English page
that states, at minimum:

- how a person connects each client class (direct MCP clients, an API-key /
  bearer client, and a hub);
- that sign-in claims an existing identity rather than minting a new one;
- that secrets are entered only on the server's own pages or a client's
  protected credential setup — never in chat;
- what a connection can and cannot do, including the server's current
  registration posture, stated plainly;
- how to disconnect and revoke;
- the fleet's standard disclaimer block (per the RAS MCP Standard and the
  website blueprint — the block's text lives there, not here).

The server's front door at `/` MUST render live status from the same state
the health endpoint reports (never hardcoded) and MUST name the manifest
address. Page design is governed by the website blueprint, not by this spec.

---

## 3. Version rules

- `rtc` is an **integer major version**. Compatibility is decided on the
  major version alone.
- A hub MUST **refuse** a server whose advertised `rtc` major it does not
  implement, with a legible refusal naming the version it saw. It MUST NOT
  guess, fall back, or translate dialects silently.
- A hub implementing RTC 2 MUST also accept RTC 1 servers, speaking the
  frozen RTC 1 surface to them, until each migrates (§11). One connection
  speaks exactly one version — the one the server's manifest declares.
- A server MUST NOT change any pinned field, shape, dialect, or behavior
  within a version. **Any incompatible change requires a new RTC version and
  a dated decision** recorded in the hub repo's `docs/DECISIONS.md`,
  adopted by each server through its own card. This is RTC 1 §9's freeze
  rule, restated as RTC 2 law, and it binds the hub and the suite exactly as
  it binds servers.
- A server MUST NOT advertise a version it does not fully serve. Partial
  adoption is not a version claim; it is a migration state (§11), recorded in
  the server's own docs, invisible in the manifest.
- Two servers with the same `prefix` MUST be refused by a hub unless they
  are deployments of the same `server` id (RTC 1 §8, carried).

---

## 4. Authorization

RTC 2 defines two transports. The **pass transport is the required
baseline**: every RTC 2 server MUST support it on the HTTPS tool API. The
**OAuth transport is optional but fully specified**: a server that offers it
MUST follow §4.3 exactly, and its manifest MUST say so (§2.1). (Decision D2,
§13: optional-but-specified in RTC 2; whether a future version requires
it is a future decision.)

### 4.1 The sequence — first contact to first call

A hub connecting to a server for the first time MUST execute, in order:

1. **Read the advertisement.** `GET /api/contract`, no auth. Verify: `rtc`
   is a version the hub implements (§3); `prefix` does not collide with an
   already-connected different server; `server`, `counts`, and `auth` are
   present and sane. Any failure stops here with a legible refusal.
2. **Choose a transport** from `auth`: OAuth if offered and the hub supports
   it, else passes.
3. **Authorize** (§4.2 or §4.3). The person — never the hub, never an agent
   acting alone — approves the account, profile, and areas on the server's
   own surface.
4. **Attest.** Before the first real call, the hub MUST make one bounded
   `search_tools` call and one `whoami` call and verify that the attested
   profile, mode, and areas match what the person chose (§4.4). A mismatch
   stops the connection; it is never papered over.
5. **Call.** Selected tool calls only, through the meta-tool family or the
   HTTPS door (§5), under the server's own guards, which no door may skip.

### 4.2 The pass transport (required)

Carried from RTC 1 §2, pinned:

- A pass is created **only by a person** — through a confirmed server tool
  (`<prefix>_create_pass`) or the server's setup/connection page — and is
  shown **once** on the server's one-time-secret page, never in chat.
- Wire format: `rtc_pass_` followed by exactly 43 unpadded base64url
  characters (32 cryptographically random bytes). Servers store passes
  hashed. Every server's secret scanner MUST reject a real-looking value by
  shape.
- Each pass carries: profile, allowed areas, `allow_writes` (default
  `false`), live/production access where the server has the concept (default
  off), a money limit where money exists (default 0), and an expiry (default
  24 h, max 30 days; a hub's pass MAY be up to 365 days **only** when the
  person explicitly ticks that option at creation).
- The HTTPS tool API accepts passes only (`Authorization: Bearer <pass>`).
  The MCP door accepts connector tokens, not passes.
- Passes are revocable instantly, server-side; a revoked or expired pass MUST
  be refused on the next call with `pass_revoked` / `pass_expired` (§8).
- Rate limits are shared across instances: counted in the server's database
  with one atomic update, never in per-instance memory. Over the limit →
  HTTP 429 with `Retry-After` and code `rate_limited`.

### 4.3 The OAuth transport (optional, fully specified)

Where offered, the server is the authorization server's resource server and
the issuer is the server's own (the fleet pattern: the server issues its own
tokens). The hub acts as an OAuth client. Normative sequence:

1. **Discovery** exactly per §2.2. The hub MUST NOT learn the issuer by
   guessing a provider brand or from any source other than the chain.
2. **Client onboarding** by an advertised method only: RFC 7591 dynamic
   client registration (`client_secret_post` or `none`) and/or a Client ID
   Metadata Document. Public clients with no secret MUST be supported —
   confidential-client-only registration is non-conforming (fleet lesson,
   RAS MCP Standard).
3. **Authorization request**: `response_type=code`, PKCE **S256**, a random
   `state`, an exact pre-registered HTTPS callback, and the RFC 8707
   `resource` parameter naming the server's MCP endpoint — in both the
   authorization and token requests. The server's consent surface accepts
   the person's `profile` and `areas` choices where the server supports
   them; the issued token MUST be bound to the intended resource.
4. **Consent is the person's**, given on the issuer's own page. No hub form
   may mint a token, and nothing in the flow may silently widen the account,
   mode, profile, areas, or scopes the person approved.
5. **Tokens**: `token_type: Bearer`, `expires_in` returned; tokens travel
   only in the `Authorization` header, never in query strings. Refresh
   tokens SHOULD rotate. If refresh is not offered, the server MUST say so
   in its metadata and the connection truthfully requires reconnect.
6. **Refresh preserves settings** (RTC 1 §2, pinned): a refresh copies the
   account, mode, profile, listing, and areas from the issuing grant. It MAY
   narrow; it MUST NOT widen, and MUST NOT fall back to defaults. A
   read-only connection stays read-only across refresh.
7. **Revocation**: the server MUST honor revocation immediately at its
   revocation endpoint and at token validation; disconnecting at the hub
   MUST revoke at the issuer and delete the hub's stored tokens.

### 4.4 Attestation (`whoami`)

`<prefix>_whoami` (MCP door) and `GET /api/whoami` (HTTPS door) MUST attest,
for the credential actually presented: the profile, the mode, the allowed
areas, and the principal/account identity. Rules:

- With a **pass**, the attestation is the pass's own scope (profile, mode,
  listing, areas, and — for write-capable passes — write and money limits).
- With **OAuth**, the attestation MUST state the account/principal and the
  effective profile/mode/areas. An attestation that confirms only a matching
  account identity (without mode/profile/areas) is sufficient for
  **read-only** authority only; a hub MUST NOT treat it as write authority.
  (This pins the Oct 18 profile's fallback as spec.)
- The hub's chosen areas/profile narrow every call **in addition to** the
  server's own guards; neither layer replaces the other.

---

## 5. Bounded enumeration

### 5.1 The meta-tool family

Every server MUST provide, on the MCP door and (via the HTTPS door) for
HTTP-only callers:

- `<prefix>_search_tools(query, area?, audience?, limit = 10, cursor?)` —
  searches the caller's visible catalog.
- `<prefix>_describe_tool(name)` — returns exactly one tool's full input
  schema and safety metadata. Describing is the only way a schema arrives;
  search results carry listing text only.
- `<prefix>_call(name, args)` — dispatches through the **same wrapped
  handler** as a direct call. No door may skip a guard.
- `<prefix>_batch(calls[≤ 10], reads only)` — read calls only; a write in a
  batch MUST be refused per-call, not executed.
- `<prefix>_get_result(handle, page?)` — result recovery (§7).
- `<prefix>_whoami` — attestation (§4.4).

HTTPS door equivalents (RTC 1 §1, carried): `GET /api/tools` (search/list),
`GET /api/tools/{name}` (describe), `POST /api/tools/{name}` (call),
`POST /api/tools/_batch`, `GET /api/results/{handle}`, `GET /api/whoami`,
`GET /api/openapi.json` (≤ 30 documented meta/workflow operations).

Visibility is scope-first: search, describe, and call MUST only ever see the
tools the presented credential's profile, areas, and mode allow. A tool
outside the caller's scope is indistinguishable from a tool that does not
exist, except that describe/call of a *known-name* out-of-scope tool returns
`outside_scope` (§8) while an unknown name returns `not_found` — the shipped
Vercel behavior, pinned.

### 5.2 Listing modes and budgets

- Modes (RTC 1 §5, carried): `catalog` (all tools in the profile) and
  `compact` (meta-tools, whoami, workflows, and the server's universal tools
  if any). Chosen per connection or pass; overridable per request with
  `?listing=` on the HTTPS door.
- **The compact listing MUST fit the fleet front-door budget: ≤ 5,000
  tokens** (RAS MCP Standard OP-1; RTC 1 §5). This is a hard conformance
  number, not a guideline.
- **Every HTTPS door response MUST fit `replyBudgetBytes` (8,192 bytes)**
  serialized. Enumeration responses obey §6 when the budget cuts a page
  short.
- No caller may obtain the full catalog in one response: enumeration is
  always paged (§6), and `limit` is capped at `maxLimit` (100).
- Search semantics, pinned minimally: `query` is a case-insensitive
  substring match over tool name and description; `area` and `audience` are
  exact filters. `count` in every page response is the total number of
  visible tools matching the filters. A server MAY rank, but within one walk
  (same credential, same filters) the ordering MUST be stable, or cursors
  cannot be trusted.

---

## 6. Pagination — the pinned dialect

This dialect is the same for the tool catalog (search/list) and for any
other paged enumeration on the discovery/connection surface. (Result
recovery has its own pinned shape, §7, because its payload is bytes, not
rows.)

### 6.1 The envelope

- **Request**: `limit` (integer, 1–100, default 20) and `cursor` (string,
  **opaque**; absent = first page).
- **Response**: the page object contains the items under their family key
  (for the catalog, `tools`), `count` (integer, total matching), and `next`
  (**string** cursor for the following page, or **`null`**).
- **Terminal condition**: `next === null`. A client MUST stop there and
  MUST NOT synthesize, increment, or guess a cursor.
- A server MAY return fewer than `limit` items when the reply budget (§5.2)
  requires it. It MUST NOT silently clip: a short page always carries a
  usable `next` unless the walk is complete. If a single item cannot fit
  the budget even alone, the list call MUST fail with `invalid_args` and a
  `todo` directing the caller to describe that item instead.

### 6.2 Cursor rules

- A cursor is **opaque**: its content is the server's own business. A server
  MAY encode a numeric offset (the shipped Vercel encoding), a keyset key,
  or a signed token. A client MUST treat it as an uninterpreted string and
  return it verbatim.
- A cursor is bound to the credential scope and the exact filter set that
  produced it. Presented with a different scope or filters, it MUST be
  rejected with `invalid_args` — never silently reinterpreted, and **never
  as a grant of a wider scope** (the shipped Vercel rule: a continuation is
  "a bounded offset, not a token granting a new scope").
- A cursor MUST NOT outlive the listing mode and profile it was minted
  under; changing either restarts the walk.

### 6.3 Why this dialect (the defense)

The two candidate dialects both shipped somewhere:

- **Page-number walks** (`page=N`, the hub HEAD suite's demand) require a
  fixed page size to mean anything. Fleet pages do not have one: a page ends
  early when the 8 KiB reply budget fills (§5.2), and different tools fill
  it at different rates. Under a byte budget, "page 2" is undefined unless
  size is negotiated and held constant, which the budget forbids. Page
  numbers also invite clients to synthesize requests the server never
  issued.
- **A pinned numeric offset** (Vercel's shipped wire form) survives the
  budget problem but freezes one server's internal mechanism into the
  contract, and forbids keyset pagination to any future server whose
  catalog is not a static array.

The opaque cursor keeps the one thing both implementations agree on — a
server-issued continuation, returned verbatim, `null` at the end — and
leaves each server's mechanism its own. Vercel's offset encoding conforms
unchanged behind the envelope (one wire change: `next` is emitted as a
string, §12); Workspace's preserved page/offset/cursor fields conform by
exposing their continuation as `cursor`/`next`. The Oct 18 profile's
permissive "(`next`, `nextOffset`, page, or opaque cursor)" list is
superseded by this section: permissiveness is what allowed two conforming
readings to be incompatible.

---

## 7. Result recovery — the pinned shape

### 7.1 When a handle is issued

A read result is serialized once, at production time, **after** `fields` /
`detail` projection (RTC 1 §7: read tools accept dotted-path `fields` and
`detail: 'summary' | 'full'`, default `summary`). That serialization — the
JSON text of the result value, UTF-8 — is the **canonical result text**.
Byte counts in this section are UTF-8 byte lengths of that text.

- If the canonical text fits the reply budget, the call returns it inline
  in the standard envelope and no handle exists.
- If it exceeds **8 KiB**, the producing call MUST return: a one-line
  `summary`, the `count` where the result has one, the total `bytes`, the
  total `pages`, the `handle`, and MAY include page 1's `content` inline.
  The full text is stored under the handle; nothing is truncated or
  summarized away.

### 7.2 The page shape

`GET /api/results/{handle}?page=N` and `<prefix>_get_result(handle, page?)`
MUST return the envelope `{ ok: true, result: { … } }` whose result object
is exactly:

| Field | Type | Meaning |
|---|---|---|
| `handle` | string | The handle this page belongs to. |
| `page` | integer | This page's number, **1-based**. `page` defaults to 1. |
| `pages` | integer | Total pages for this handle. Fixed at handle creation; a client may rely on it. |
| `bytes` | integer | Total UTF-8 bytes of the canonical result text (not of this page). |
| `content` | string | This page's slice of the canonical result text. Concatenating `content` over pages `1..pages` in order MUST reproduce the canonical text exactly. |
| `next` | integer \| null | `page + 1` when more pages remain, else `null`. **Terminal condition: `next === null`.** |

Rules:

- Page size is the server's choice, subject to one hard limit: the whole
  serialized response MUST fit `pageBudgetBytes` (8,192). A server SHOULD
  use the largest slice that fits.
- Projection (`fields`/`detail`) happens at production time only. Recovery
  serves the stored text; there is no per-page projection in RTC 2. (RTC
  1's `get_result(handle, page?, fields?)` signature loses the `fields`
  parameter for this reason.)
- A page request beyond `pages` MUST fail with `invalid_args`.

### 7.3 Handle lifetime and scoping

- Handles are unguessable: at least 128 bits of cryptographic randomness,
  never derived from account or result identifiers, never logged.
- A handle is scoped to the **issuing connection or pass only** (RTC 1 §7,
  carried). Presented under any other credential — including another pass
  for the same account — it MUST return `not_found`, not a permission
  error: the handle's existence is not leaked across scopes.
- Lifetime: **24 hours** from creation (`handleTtlSeconds: 86400`), per the
  manifest (§2.1). An expired handle returns `not_found`.
- Result pages never re-execute the producing call. Recovery is a read of
  stored bytes, with no provider side effects (Oct 18 profile, pinned).

### 7.4 Why content pages (the defense)

The shipped alternatives:

- **Record pages** (Vercel's shipped shape: `{page (0-based), limit, count,
  records, next}`) assume every result is an array of records. Many are
  not — objects, scalars, and text results must be wrapped to fit, and the
  wrapping is itself an unpinned dialect. Record pages also project per
  page at read time, so page contents depend on the formatter at read time,
  not on what the caller actually produced.
- **Content pages** (the hub HEAD suite's shape) are type-universal: any
  result serializes to text once, and recovery is exact byte accounting
  over that text. They match how the hub already treats large routed
  results (its encrypted result paging binds pages to a connection and
  never re-runs the call). The cost is real and is Vercel's to pay in
  migration (§12): one route changes shape, and per-page field projection
  at recovery time goes away — projection moves to call time, where RTC 1
  already defines it.

Decision D1 (§13) confirmed this choice when RTC 2 was adopted; the
alternative's costs are stated in §13's record of the ruling.

---

## 8. Errors

Every failure on the discovery/connection surface uses the RTC 1 §7 envelope,
pinned:

```json
{ "ok": false, "error": { "what": "…", "cause": "…", "todo": "…", "technical": "…", "code": "…" } }
```

- `what` says what failed in plain words; `cause` says why; `todo` says what
  the caller can do about it; `technical` carries detail safe to log;
  `code` is the machine-readable code.
- The code set is RTC 1 §7's, unchanged: `needs_confirmation`,
  `refused_by_guard`, `not_found`, `permission`, `service_error`,
  `rate_limited`, `pass_expired`, `pass_revoked`, `invalid_args`,
  `outside_scope`. No server may invent codes on this surface; a genuinely
  new code is a spec amendment (§11).
- `rate_limited` MUST be HTTP 429 with a `Retry-After` header (§4.2).
  `pass_expired` and `pass_revoked` MUST be refused before any tool
  executes. No error response may contain a credential, a pass value, or a
  key-shaped string (checked by the `safety` probe).
- Success uses `{ ok: true, result, handle?, mode? }` (RTC 1 §7, carried);
  the MCP door returns the same content as text plus `structuredContent`
  for workflows.

---

## 9. Hub obligations

A hub claiming RTC 2 support MUST:

- Follow the discovery order of §4.1 exactly: advertisement first, then the
  advertised discovery chain, then authorization, then attestation, then
  calls. It MUST NOT skip attestation.
- Assume **nothing beyond the advertisement**. Any capability not declared
  in the manifest or the discovery chain does not exist for connection
  purposes. In particular, the hub MUST NOT infer an issuer, an endpoint, or
  a dialect from a provider's brand or from another server's behavior.
- Speak exactly the version the server declares (§3): the RTC 2 surface to
  RTC 2 servers, the frozen RTC 1 surface to RTC 1 servers. Silent dialect
  translation is prohibited; where the hub internally normalizes (e.g. its
  own cursor format for its callers), the server-facing exchange follows
  the server's declared version exactly.
- **Journal every routed call** in its own change log, pointing at the
  server's change-log row (`logged.id` in write results, RTC 1 §8).
- Keep per-person, per-caller-family credential isolation: one person's
  tokens or passes MUST never serve another caller, and no credential may
  appear in chat, logs, or public documents.
- Honor `rate_limited`: back off per `Retry-After`; never retry an
  uncertain write (a write whose outcome is unknown is reported, not
  repeated).
- Enforce the person's chosen profile and areas as its own narrowing layer
  on every routed call, in addition to the server's guards (§4.4).
- Refuse duplicate prefixes and unknown versions legibly (§3), and surface
  the refusal to the person with the remedy.

## 10. Server obligations

An RTC 2 server MUST:

- **Advertise truthfully.** Every manifest field — counts, version,
  revision, modes, auth offers — describes the deployment actually serving
  it. A stale or aspirational manifest is a conformance failure of the
  server, not a documentation issue.
- **Never reach out.** No callbacks, registration pings, webhooks, or
  heartbeats to any hub; no code that requires a hub to exist (§1.2).
- **Never expand eagerly.** No response on the discovery/connection surface
  may exceed the budgets of §5.2; the full catalog is reachable only through
  paged enumeration (§6).
- **Guard every door identically.** A call through `_call`, through the
  HTTPS door, or through a direct tool invocation passes the same profile,
  area, mode, and confirmation guards (RTC 1 §4: no door may skip a guard).
- **Honor revocation instantly** — passes (§4.2) and OAuth grants (§4.3)
  alike — and honor narrowed scopes on the next call after a change, with
  no caching window that outlives the change.
- **Operate standalone.** Direct clients get the same tools, guards, and
  results with no hub involved; the server MUST NOT degrade, gate, or
  watermark direct use.
- **Keep secrets out of the surface.** No service credential is ever a tool
  argument or a response value (RTC 1 §2); no pass value or key-shaped
  string appears in any response, error, or log line.

---

## 11. Conformance & governance — the anti-drift law

This section is the reason RTC 2 exists. It is spec law, not commentary.

1. **The text is normative; the suite is derived.** `packages/conformance`
   tests this document. Where suite and text disagree, the text wins and
   the suite has a bug. A suite check that demands behavior this document
   does not specify is defective by definition and MUST be fixed in the
   suite or removed — a server MUST NOT be pressured, scored, or failed
   into matching an unpinned probe.
2. **Every probe maps to a section.** The suite MUST carry a probe→section
   map (Appendix A is the seed), and every probe MUST cite the section it
   tests. A probe without a citation is not part of the conformance suite.
3. **Fixtures, never fixture semantics.** Probes that need a real read or
   write tool MUST run against tools the server under test declares in its
   own CI fixture configuration (a named read tool, a named guarded write
   tool, field and value-argument names). Probes MUST NOT hardcode a tool's
   position in a catalog, an argument name, or a payload field. (The frozen
   RTC 1 suite's hardcoded `value`-in/`value`-out semantics — passable only
   by the hub's own fake server — are the failure this rule exists to
   prevent.)
4. **Skipped is not passed.** A probe that cannot run reports `skipped`
   with a reason and counts against certification exactly as RTC 1 §9
   froze it: the overall verdict is false unless every applicable required
   probe passes.
5. **Change process.** An incompatible change to anything this document
   pins requires: a new RTC version, a dated decision in the hub repo's
   `docs/DECISIONS.md`, and adoption by each server through its own card.
   The hub, the suite, and every server are bound identically. Editorial
   clarifications that change no pinned behavior MAY land as dated errata
   in `DECISIONS.md`, listed in this document's changelog.
6. **Disposition of the drifted suite.** The post-freeze hub-HEAD suite is
   neither ratified nor condemned wholesale; it is superseded as follows:
   its **fixture mechanism is adopted** (rule 3 above is its good idea,
   promoted to law); its **catalog dialect demand** (`page=N` walks) is
   superseded by §6; its **result-recovery demand** is adopted in shape by
   §7 — as RTC 2 text, under this version, not as a silent RTC 1 amendment.
   The frozen pin suite remains the RTC 1 conformance suite, unchanged.

---

## 12. Migration — the path from RTC 1

There is no flag day. The hub supports RTC 1 and RTC 2 servers side by side
(§3); each server below migrates by its own card, on its own schedule, and
advertises `rtc: 2` only when it fully serves this document (§3).

**The hub** gains: version dispatch (RTC 1 frozen surface + RTC 2 surface),
the §4.1 sequence as its only enrollment path, and a conformance suite
re-derived from this document with its probe→section map. Its internal
normalization for its own callers (e.g. translating continuations into its
signed cursors) is hub-internal and does not touch the server-facing wire.

**Vercel MCP** (cursor-offset catalog; record-page results). Changes: the
manifest gains `revision`, `listing`, `results`, and the `auth` object
(§2.1); `next` in listing responses is emitted as a **string** (its offset
encoding is unchanged behind the envelope, §6.3); the result route changes
from record pages to content pages (§7), and `fields`/`detail` stop being
accepted at recovery time (projection already happens at production).
Unchanged: passes, whoami attestation, the write lifecycle, listing modes —
all already conform. Its R-3 card completes against the frozen RTC 1 checks
(the dossier's option (b) legs), and RTC 2 adoption is a separate follow-on
card; this document is the dated-version successor that RTC 1 §9 always
required before the dialects could legitimately move.

**Workspace MCP** (preserved page/offset/cursor fields; isolated expiring
result handles). Changes: expose its continuation in the pinned
`cursor`/`next` fields (§6); serve result recovery in the §7 content-page
shape; the manifest gains `revision`, `listing`, `results`, `auth`. Its
2026-10-19 owner decision already forbids silent wire changes on its side —
adoption happens by its own card and a dated decision, exactly as that
decision prescribes. Its OAuth transport, present in source, is declared in
`auth.oauth` when the server offers it for connection.

**GitHub MCP** (the fleet's front-door reference implementation). Its RTC
door is the newest; it adopts the §2.1 manifest fields and the §6/§7
dialects as it completes its RTC surface, and its connection page is the
fleet's shape reference for §2.3.

**Dokploy MCP** (smallest RTC surface). No immediate change: it remains a
legitimate RTC 1 (or pre-RTC) server behind a dual-version hub, declared as
such, and adopts RTC 2 when its RTC door is built out — from this document
and the Starter Kit, not from any other server's code.

**New servers** are born RTC 2: manifest, pinned dialects, and the derived
suite from day one.

---

## 13. Decisions as ruled (2026-10-31)

The five choices this document was drafted around were ruled by the owner
(Chris) on 2026-10-31, all as recommended, and are recorded in the hub
repo's `docs/DECISIONS.md` ("2026-10-31 — RTC 2 adopted as RTC 1's §9
successor; the RTC 1 freeze holds"). They are part of the adopted text:

**D1 — Result pages: content pages.** §7 as written is the contract:
recovery serves byte-exact content pages over the canonical result
serialization. (The alternative — shipped record pages — costs nothing for
list-shaped results but only works when a result is a list of records;
everything else would be wrapped in an invented shape each server
re-invents.)

**D2 — OAuth: optional-but-specified.** Passes are the required baseline
(§4.2); the OAuth transport is fully specified (§4.3) for servers that
offer it. Requiring OAuth in RTC 2 was declined: servers without an issuer
could not claim RTC 2 until that work lands, and the fleet's migration
would stretch for a timing gain, not a direction change.

**D3 — Handle lifetime: 24 hours.** Carried from RTC 1 unchanged, and now
pinned in the manifest (`handleTtlSeconds: 86400`, §2.1) where RTC 1 left
it in prose.

**D4 — Health path: included in the advertisement.** `health` is a
SHOULD-level manifest field (§2.1), so the one-watcher hub discovers what
to watch from the same document it discovers everything else in.

**D5 — R-3's disposition: the composite.** The RTC 1 freeze holds — R-3
completes against the frozen checks, the drift is recorded (§11 rule 6),
and no shipped dialect is amended to chase an unversioned suite — AND RTC 2
is adopted by the same dated decision as RTC 1's §9 successor, so the
drift's sound ideas (fixtures, content-page recovery) enter properly, as
this new version. Option (a) (ratifying the drift inside RTC 1) was
declined: cheaper this month, and a standing lesson to every future suite
that the freeze is negotiable.

---

## Appendix A — Probe → section map (seed)

The RTC 2 suite MUST ship this map completed; every probe cites its section
(§11 rule 2). Starter set, derived from the RTC 1 named probes:

| Probe | Tests |
|---|---|
| `manifest` | §2.1 — manifest present, no auth, all required fields, pinned dialect declarations |
| `manifest.truth` | §2.1, §10 — counts and revision match the serving deployment |
| `manifest.openapi` | §5.1 — bounded OpenAPI operation count |
| `discovery.chain` | §2.2, §4.3 — protected-resource and issuer metadata agree with the manifest |
| `passes` | §4.2 — missing, read-only, expired, and revoked passes refused correctly |
| `oauth.refresh_settings` | §4.3 — refresh preserves account/mode/profile/areas |
| `oauth.attestation` | §4.4 — whoami attests scope; account-only attestation caps at read-only |
| `catalog` | §5, §6 — prefix, metadata, visibility, cursor walk terminates with `next: null`, count honest |
| `budget` | §5.2 — compact listing ≤ 5,000 tokens; replies ≤ 8,192 bytes |
| `meta` | §5.1 — search/describe/call/batch through the meta-tools; batch refuses writes |
| `reads` | §7 — >8 KiB result issues a handle; content pages concatenate exactly; cross-scope handle is `not_found` |
| `writes` | RTC 1 §6 via §1.3 — dryRun inert, needs-confirmation, confirm + read-back + `logged.id`, against server-declared fixtures (§11 rule 3) |
| `limits.two_instance` | §4.2 — shared rate limits across two processes, one throwaway database |
| `safety` | §8, §10 — no key-shaped strings anywhere; error envelope and codes exact |
| `owner` | RTC 1 §11 via §1.3 — admin overview, guided settings, account-wide confirm |

## Appendix B — What RTC 2 changes, in one list

New in RTC 2 (all on the discovery/connection surface):

1. The manifest is an exact document (§2.1) — new required fields: `server`,
   `revision`, `listing`, `results`, `auth`, `connection`.
2. Pagination is one pinned dialect: opaque `cursor`, string `next`,
   `null` terminates (§6). RTC 1 §7's "one page … with `next`" is superseded.
3. Result recovery is one pinned shape: content pages over the canonical
   serialization, 1-based, byte-exact, 24 h, scope-bound (§7). RTC 1's
   `get_result` loses its `fields` parameter.
4. The hub's first-contact sequence is a numbered, checkable procedure
   (§4.1), with attestation as a hard gate (§4.4).
5. The OAuth transport is fully specified for servers that offer it (§4.3);
   passes remain the required baseline (§4.2).
6. The anti-drift law (§11): the suite is derived and non-normative, probes
   cite sections, fixtures are mandatory, and the change process binds the
   hub and suite as it binds servers.

Unchanged from RTC 1: the write lifecycle, tool shape and metadata, pass
format and safety rules, listing modes, the error envelope and code set,
developer conventions, and owner/administration conventions.

---

*Adopted 2026-10-31 by the owner's dated decision in `docs/DECISIONS.md`
(D1–D5 ruled as recommended; §13). Each server adopts through its own card
(§12).*
