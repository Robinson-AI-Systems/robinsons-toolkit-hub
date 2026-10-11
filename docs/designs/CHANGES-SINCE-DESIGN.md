# Changes since design

Dated entries only: contract changes later cards inherit and that are not yet in their design.

(none yet)

## D-3b — 2026-10-11
D-3 successor reuses createRelayRuntime / createRelayServer / createReplayStore.
GitHub comment cap is 65,536 bytes; encrypted payload cap 40 KiB, RTC reply 32 KiB.
Runtime bindings are issue → numeric actorId and server alias, scoped to private repo.
Production env is unset; deployment and real passes remain owner-gated.

## D-3 — 2026-10-11
D-4 inherits direct-first CLI/MCP routes and docs/RELAY-DEPLOY.md. Runner must use
read-only tools and env-named passes; no real pass, production smoke or fake live
claim. Unknown write outcomes require service change-log inspection.

## D-4a — 2026-10-11
D-4 real-run card remains owner-gated. K-3 implementer must verify the current
Stripe repo A–C and actual core candidates before writing its JIT extraction card.
Five-PR concise handoff is permanent; this session explicitly stops at #20.
