# Server playbook — how to build one of Chris's service servers

How to turn one service (Vercel, Neon, GitHub, …) into a solid, hosted, **standalone** MCP server with a large, trustworthy
tool set that follows the Robinson Tool Contract. Every server is a **general development tool**: it must serve an agent
**building** something with the service (test data, throwaway environments, simulation, integration checks) as well as
one **operating** it. Real projects are completeness checks ("could it do everything that project needed?"), never the
scope. The Stripe MCP (`Robinson-AI-Systems/stripe-mcp`) is the reference
implementation of this playbook; copy from it rather than inventing.

**Why separate servers, including ones that have official connectors** (Chris, 2026-10-10): official connectors give
less functionality than Chris needs, and different agents get different permissions with them. A Robinson server gives
every agent the same full tool set with Chris's safety rules, through any door.

## 1. When to start one

Only when Chris needs it (`docs/kit/SERVER-ROADMAP.md` lists the candidates and their order). Starting = a Batch S card
in this repo (`S-<server>`), which produces the new repo's whole plan. Chris creates the empty repository
(`Robinson-AI-Systems/<server>-mcp`, public unless he says otherwise).

## 2. Research (one bounded session, written into the new repo's `docs/audits/`)

1. **The service's API surface.** Prefer its published OpenAPI or GraphQL schema (vendored into `vendor/`, version
   recorded); otherwise its REST reference. List every resource and operation, and mark each: read / write / destructive /
   money / production-affecting.
2. **What the old toolkit had** for this service (`robinsons-toolkit-mcp` `registry/<ns>.json`, `handlers/<ns>.js`) and its
   pass rate from the Batch M smoke test. Old code is a reminder of *what* existed, never copied.
3. **What the official connector offers** (if any), so the new server is a clear superset for Chris's needs.
4. **Credentials.** The narrowest token type the service offers (scoped/restricted tokens, per-project tokens); which
   scopes each profile needs.
5. **Testing options.** An official mock (like `stripe-mock`), a sandbox/test mode, a free test account or project, or only
   recorded fixtures. Decide the mock layer.
6. **Service-specific danger.** What can hurt Chris: deleting a production project or database branch, a production
   deploy, DNS changes, force-pushes to `main`, sending messages to customers, spending money, revoking access. Each gets a
   guard (§4).
7. **Projects that run on it** (for example Appliance Desk on Vercel/Neon/GitHub): what an app owns there → optional
   **project profiles** (Stripe MCP Batch P is the model: the server never fights an app that manages its own resources).
   Use one or two real projects as a completeness check of the catalog.
8. **Developer workflows.** What does an agent need while *building* with this service? Usually: realistic test data
   (scenarios), throwaway environments (a database branch, a preview deployment, a scratch repo, a test account),
   simulation (events, time, failures), precise cleanup by run, and an integration check for an app under development.
   These become the server's **Batch V** and follow contract §10.
9. **The owner and administrator side.** Everything an account owner sets up and runs in the service's dashboard:
   account and business details, verification, team members and roles, security (two-step login, keys and tokens, SSO,
   audit logs), the service's own plan, usage and billing, notifications and emails, integrations and connected apps,
   compliance settings. For each: API or dashboard-only. API → real tools; dashboard-only → guided settings with
   structured steps and read-back (contract §11). Walk every settings page of the dashboard to build the map; the old
   toolkit's audits found this side "broadly absent" across its namespaces, so it is checked explicitly.
10. **Coverage matrix.** One table in the research file: each area × audience (builder / owner / operator) → covered by
   which tools. Gaps are decisions, written down, never silent.

## 3. The plan (copy the system)

Copy from the Stripe MCP, replacing the service: `AGENTS.md`, `CLAUDE.md`, `docs/START-HERE.md`, `SESSION-START.md`,
`PLAYBOOK.md`, `implementation-contracts/DRIFT-PROTOCOL.md`, `pr-cards/README.md` + `validate-index.py` + `work-index.json`,
`designs/TEMPLATE.md`, `OWNER-INPUTS.md`, `GO-LIVE-CHECKLIST.md`, `DECISIONS.md`, `ROADMAP.md`, `ARCHITECTURE.md`,
`AI-PR-READ-FIRST.md`, `OWNER-GUIDE.md`. Once K-4 exists, `rtool new-server <name>` does this.

**Standard batches** (rename letters only if the service needs it):

| Batch | Contents | Source |
|---|---|---|
| A Foundation | **A-1 makes the repo implementation-ready and proves it**: package (Node 24.x, exact versions, committed lockfile), the service fake validated against the vendored API description, throwaway-Postgres tests, check scripts that really check, CI with independent jobs and one aggregate `ci` gate — shown red by a temporary failing test, then green, before merge; cards A-2/A-3 written. Then login, credential store + setup page, service client wrapper (pinned API version where the service has versions; retries; idempotency where supported) | `robinson-mcp-core` + Stripe Batch A pattern |
| B Trust layer | `defineWrite` with service-specific guards (§4), plain-English errors for this service, result shaping, profiles | core + Stripe Batch B pattern |
| C Context | summaries, fields/detail, handles, compact listing, budgets | core (mostly free) |
| D… Area batches | the hand-built tools, one batch per area group (each card one area) | the tool catalog |
| O Owner and administration | admin overview, account and team, security, the service's own billing and plan, notifications, integrations; guided settings with structured steps and read-back; full dashboard map (contract §11) | Stripe Batch G-6 pattern |
| V Developer tools | test data scenarios, runs and cleanup, throwaway environments, simulation, integration check — test/preview modes only (contract §10) | Stripe Batch V pattern |
| P Project profiles | optional, when an app manages its own resources in this service | Stripe Batch P pattern |
| W Workflows | the jobs Chris actually does, in one sentence | his requests and the old compound tools |
| U Universal | `api_search` / `api_describe` / `api_read` / `api_write` (or a schema-checked GraphQL pair) for everything not hand-built | Stripe Batch U pattern |
| R Contract doors | passes, HTTPS tool API, manifest, conformance | core + Stripe Batch R |
| X Close-out | undo, real-account read-only smoke test | Stripe Batch X |

## 3b. Lessons from the first four servers (2026-10-10)

- **Every tool name starts with the server prefix** (contract §3). A name that looks like a credential prefix (for
  example `github_pat_…`) is renamed, or every secret scanner flags the catalog.
- **Node 24.x**; GitHub Actions on current major versions (Node 24 runtimes).
- **Gap check before publishing the plan:** map every tool the old toolkits built or planned for the service
  (`robinsons-toolkit-mcp`, `robinsonai-mcp-servers`, `robinsons-toolkit-api`) to the new catalog in
  `docs/audits/<date>-prior-tools.md` — covered, universal, dropped with a reason, or added. Earlier "all tests pass"
  reports in those repos only checked definitions or environment variables; never count them as evidence.
- **The workspace proxy blocks many vendor sites** (OpenAPI downloads answered 403): plan a documented fallback source
  (the vendor's npm package) with a hash, and retry the live file in the card that pins it.
- **PRs through the REST API** (`gh api …/pulls`); `gh pr` GraphQL commands are blocked. CI waits are bounded
  (check once a minute, ~15 minutes); job logs may not download through the proxy — read check-run annotations.
- **An organization-wide Codex reviewer posts on every new repo** even when a repo says "no automated review": handle and
  resolve its threads, never wait for one.

## 4. Guards every server decides up front

- **Destructive / irreversible:** always `confirm`, read-back, change log.
- **Production:** anything that affects a production deployment, database, domain or branch needs `confirm` even when the
  same action on a preview would not (the Stripe "live guard" pattern, applied to production).
- **Money / spend:** buying, plan changes, usage that bills — always `confirm`, a dollar preview, a daily limit if money can
  move repeatedly.
- **Messages to people** (email, SMS, chat): always `confirm`; previews show the exact text and recipients.
- **Access and permissions:** widening anyone's access always needs `confirm`.
- **App-owned resources:** project profiles refuse changes to resources an app manages, unless `outsideApp: true`.

## 5. Building a massive tool set without losing quality

- **Hand-build the tools that matter** (the operations Chris and his apps use, plus their close neighbours) — typically
  100–300 per large service. Every one passes the write-contract checks and a mock or fixture test.
- **Universal tools cover the rest** of the API on day one, validated against the service's own schema, with the same
  guards. Repeated universal calls in the change log are the signal to hand-build a tool.
- **Never generate tools blindly from a schema** into the registry: generated tools have weak descriptions, no guards and
  no tests. A generator may draft the catalog table; a person-reviewed card builds each tool.
- **Budgets keep it cheap:** compact listing, summaries, handles — inherited from core.
- **Pin and watch versions:** the service's API version is pinned; moving it is its own card with a changelog review.

## 6. Definition of done for a server

1. Every catalog tool built and tested; every write passes the write-contract checks through MCP, `_call` and HTTPS.
2. RTC conformance green in CI (`packages/conformance`).
3. A read-only smoke test against Chris's real account in its safest mode, report committed.
4. Deployed on Vercel with its own Neon database; DEPLOY.md followed by Chris; connector added in Claude.
5. The coverage matrix shows every area served for builders, owners and operators; owner-side settings are tools or
   guided settings (contract §11), and `_admin_overview` works against the real account.
5b. Developer tools (Batch V) follow contract §10: refuse production, record runs, clean up only what they created.
6. Usable through `rtool` directly (and the relay) with a pass, proven by `scripts/agent-check.mjs`.
7. Registered in the hub (once the hub exists) and listed as "live" in `docs/kit/SERVER-ROADMAP.md`.
