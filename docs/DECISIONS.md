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
