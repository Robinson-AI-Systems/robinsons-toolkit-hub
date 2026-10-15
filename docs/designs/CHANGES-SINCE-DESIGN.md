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
Concise handoffs remain required; session count and scope come only from the current owner prompt.

## K-3 prerequisite inspection — 2026-10-11

Stripe `2a71f8a03845ad3bf8c8de9de4207a72596ace78` marks A–C merged, but
BATCH-K K2's whole-core portability assumption is false: mcp-server imports
provider result/error helpers; profiles hardcodes Stripe names/areas; write binds
stripeAccount; OAuth/one-time secret handlers bind account columns/setup URLs/AAD.
[Implementation guide §6](../implementation-contracts/IMPLEMENTATION-GUIDE.md#6-worked-next-unit-k-3-extraction-boundary-then-portable-first-slice)
records exact sources/tests and a proposed portable-first extraction packet.
K-3 stays JIT/unimplemented; its implementer must recheck source and reconcile a
dated BATCH-K amendment before semantic adapter changes. No adoption executed,
release created, scope changed or owner gate lifted by this documentation.
