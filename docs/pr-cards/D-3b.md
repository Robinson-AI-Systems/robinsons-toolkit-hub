# D-3b — signed encrypted relay server

Status: MERGED (#18). Design: BATCH-D §1 D4, §2, §4 D-3.
Baseline inspected: ed269a97e4dbdfa4532980e9b36e80dff3928f6b (#17).
Prerequisite: D-3a. Risk: relay authentication; one additive migration.
Budget: approximately 500 production lines, hard maximum 800.

## Read only these
- AGENTS; SESSION-START; AI-PR-READ-FIRST; drift protocol A/B.
- BATCH-D relay sections; OWNER-INPUTS IN-02/03/04.
- packages/relay/src/crypto.js; packages/cli/src/relay.js.
- tests/db/isolated-schema.js; PLAYBOOK Steps 4–10.

## Drift A
| Assumption | Actual | Correction |
|---|---|---|
| Client encryption exists | #17 merged | Reuse its envelopes |
| Relay deployment exists | Not provisioned | Build only; retain IN-02/03/04 |
| D-3 fits one PR | Server, routes and cleanup have distinct tests | D-3b server; D-3 completion routes/cleanup |

## Build contract
- webhook.js: verify raw Buffer with timing-safe HMAC SHA256 before JSON parsing;
  private fixed repository, configured issue/actor/server binding, created events only.
- store.js: atomic insert into relay_seen; fail closed on DB failure. No passes at rest.
- forward.js: server-name allowlist; RTC HTTPS doors only, redirects refused;
  bounded replies, neutral errors, no service-key access or server guard bypass.
- server.js: verify/decrypt/claim/call/encrypt/post in order; no execution on replay.
- runtime.js and api/relay/github.js: lazy environment validation and Postgres pool,
  raw body handler, generic HTTP results; disabled on missing owner configuration.
- D-3 owns CLI fallback, hourly cleanup and deployment recipe next.

## Named tests / commands
- webhook-server.test.js: signature, private repo/actor/issue bindings, tamper,
  replay, guarded read/write/revoked pass and no plaintext in GitHub bodies.
- tests/db/relay-seen.test.js: independent pools competing for same UUID,
  unrelated UUID and DB failure. CI throwaway Postgres proof if unavailable locally.
- npx vitest run packages/relay/test; npm run test:doors;
  npm run test:conformance; npm run test:db -- tests/db/relay-seen.test.js;
  npm run check; npm test.

## Done when
- Each security boundary above has positive and negative evidence.
- ci green at exact head; self-review and docs updated; owner gates retained.
- Successor inherits createRelayServer, createReplayStore and raw Vercel handler.

## Evidence
13 relay tests and 2 client tests pass locally; independent-pool replay tests are
implemented for CI Postgres. No local Postgres binary is available.
Reply/crypto cap adjusted to fit GitHub 65,536-byte comments; no silent truncation.
