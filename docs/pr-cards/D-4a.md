# D-4a — agent setup recipes and read-only verification runner

Status: MERGED (#20). Design: BATCH-D §4 D-4 and §5.
Baseline inspected: d0473e2aee760c6b5cfc9b4cde395c1d3751c3ad (#19).
Prerequisites D-2/D-3. Risk: agent door verification; no migration.
Budget: approximately 250 production lines; smaller because real deployment is gated.

## Read only these
- SESSION-START, drift protocol, AI-PR-READ-FIRST.
- BATCH-D D-4; OWNER-INPUTS IN-02/03/04; RELAY-DEPLOY.
- packages/cli/src/{config,dispatch,http}.js; fake RTC whoami/tool metadata.

## Drift check A
| Assumption | Actual | Correction |
|---|---|---|
| Relay exists | Code tested; resources/keys not configured | No real relay-run claim |
| Real pass may be used | Owner authorization required by AGENTS | Default localhost only; real run opt-in does not itself grant approval |
| D-4 complete in one PR | Real routes need owner setup | D-4a runner/recipes; D-4 WAITING for real-run evidence |

## Build contract
- scripts/agent-check.mjs uses named environment pass/args values only, never argv secrets.
- packages/cli/src/agent-check.js checks manifest, read-only whoami, selected tool
  metadata, actual guarded read and optional handle; no writes, secret output or full
  service result logs. Expected route must equal observed fallback behavior.
- Default test target is localhost; external URLs require separately owner-authorized
  real-run opt-in. Missing credential stops before any fetch.
- docs/AGENT-SETUP.md covers all nine environments and paste-in guidance.
- No production resource activation. Real D-4 route evidence stays WAITING.

## Named tests / commands
- agent-check.test.js: actual fake RTC read, full-pass/write refusal, missing pass,
  external-origin default refusal, actual route mismatch and error-safe output.
- npm run check; npm test; npm run test:doors; npm run test:conformance;
  CI db regression gate. Runner smoke on throwaway fake only.

## Done when
Runner and all environment recipes tested/documented; no acceptance overclaimed.
Exact-head CI/self-review green. D-4 owns real approved passes/routes/revocation.
Next executable card is K-3 after fresh Stripe A–C prerequisite verification.

## Evidence
Local fake RTC tests prove read-only identity/metadata/read, full-pass and write
refusal, missing credential and external-default gates, error-safe output.
Signed fake GitHub relay integration proves expected relay route for all probes.
D-4 remains WAITING with explicit evidence/revocation checklist; no real pass used.

Final review also pins the inherited cleanup scheduler to Node 24 and explicit
ES module stdin; its actual embedded script passes Node syntax validation.
