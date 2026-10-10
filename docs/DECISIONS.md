# Decisions (dated)

**2026-10-10 — One standalone server per toolset; Robinson's Toolkit becomes the front door.** After a reality check
showed the old toolkit's 3,049 tools are cheap on context (search-then-call already) but unverifiable (its test script
only checks that keys exist; `TEST_RESULTS.md` claims all functional), Chris chose to build each toolset as its own
solid, hosted server — Google Workspace MCP and Stripe MCP first — and make Robinson's Toolkit the single MCP, CLI and
HTTPS front door combining them. Audit: `docs/audits/2026-10-10-old-toolkit.md`.

**2026-10-10 — Build Chris's own servers even where official connectors exist (Chris).** Official connectors for
Vercel, Neon and others give less functionality, and different agents get different permissions with them. Robinson
servers give every agent the same full tool set with Chris's safety rules.

**2026-10-10 — Servers stay fully usable on their own; build them as needed (Chris).** The hub is a long-term project.
So this repo delivers the direct doors first (`rtool`, local MCP, GitHub relay), which work with any single server
without the hub, and no server ever depends on the hub.

**2026-10-10 — The Robinson Tool Contract (RTC 1).** A written contract (`docs/CONTRACT.md`) every server follows, with a
conformance test, so the hub stays a thin router and every agent sees identical behavior from every server.

**2026-10-10 — Shared code is extracted, not designed up front.** The Stripe MCP writes its contract code in `src/core/`;
this repo extracts it into `robinson-mcp-core` once proven (K-3), and other servers adopt it.

**2026-10-10 — Relay encrypts to the relay's own key.** The GitHub relay seals requests (including the pass) to the
relay's public key, so GitHub sees only ciphertext and servers never need to know about the relay.

**2026-10-10 — Public repository, no automated review**, as for the Stripe MCP.

**2026-10-10 — A general development tool (Chris).** "This should be general, able to work freely on any project … It
is supposed to be a powerful development tool." Real projects are completeness checks only. Added contract §10
(developer conventions: safe modes, runs tagged `rtc_run`, cleanup by run, scenarios, integration checks), a Developer
tools batch (V) to the server playbook, generic purposes in the server roadmap, and development-environment up/down as
the hub's flagship cross-server workflows. Stripe gained its Batch V; Workspace gained P8-7.

**2026-10-10 — Owners and end users too, not only developers (Chris).** "These toolsets should be great for both
developers and end users of each service, account management tools … everything." Contract §3 adds an `audience` tag
(builder / owner / operator); new §11 requires every server to cover the owner side: an admin overview, real tools for
every owner setting with an API, guided settings with structured steps and read-back for everything without one, and a
full dashboard map. The playbook adds research steps 9–10 (owner side, coverage matrix) and a standard batch O; the hub
adds L-4, a guided settings runner that walks dashboard-only settings in a visible browser with Chris approving each step
(never typing passwords). The old toolkit's audits had found account, team, billing and security tools "broadly absent".

**2026-10-10 — Two rules from the Workspace server's review (RTC 1 clarification).** An automated review of the Google
Workspace MCP plan (its PR #28) found that (1) an OAuth refresh could drop a connection's settings (a read-only
connection becoming full access) and (2) an in-memory rate limit does nothing on serverless hosts. Contract §2 now
requires both (settings copied on refresh; limits counted in the database), conformance checks both, and the hub, relay
and Stripe plans follow. RTC 1 is not final until K-1, so this is a clarification of version 1, not a new version.
