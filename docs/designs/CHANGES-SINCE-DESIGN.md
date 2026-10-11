# Changes since design

Dated entries only: contract changes later cards inherit and that are not yet in their design.

(none yet)

## D-3b — 2026-10-11
D-3 successor reuses createRelayRuntime / createRelayServer / createReplayStore.
GitHub comment cap is 65,536 bytes; encrypted payload cap 40 KiB, RTC reply 32 KiB.
Runtime bindings are issue → numeric actorId and server alias, scoped to private repo.
Production env is unset; deployment and real passes remain owner-gated.
