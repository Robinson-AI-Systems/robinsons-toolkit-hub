# K-3 Release gate evidence — 2026-10-11

**Decision: NOT READY / NOT RELEASED.** This is a status and ordered
verification packet, not a release authorization. The public GitHub Releases
list for this repository was empty at inspection. No tag, asset, deployment,
provider credential or server-repository mutation is authorized by this file.

## What currently exists and what it proves

| Evidence | Verified boundary | What it does not prove |
|---|---|---|
| `packages/core/package.json` | Eleven explicit ESM exports, private 0.1.0 workspace | A published public GitHub Release or installed service |
| `scripts/verify-core-package.mjs` | No provider imports, hidden files, install scripts or undeclared imports | Behavioral compatibility with a production server |
| `K3-SOURCE-TRACE.json` | Git blob evidence: five byte-identical modules, six adapted modules | All adapted source assertions or source service SQL |
| `K3-ASSERTION-COVERAGE.json` and its check | Five verbatim exports' 21 local assertion cases; four explicitly excluded service-owned cases | Identical upstream assertion bodies, direct HTTP source suite parity or all adapter boundaries |
| `packages/core/test/oauth-compat.test.js` | Exact-token issuance/rotation through service injectables | Stripe owner UI, real session DB, actual expiry/revocation across instances |
| `packages/core/test/write-safety-parity.test.js` | Monetary shape refusal, decision preflight, classifier uncertainty | Independent authenticated owner money-out authorization or shared account/day limit |
| `packages/core/test/mcp-dispatch-compat.test.js` | Direct own-handler dispatch, guarded nested call, scoped result metadata | Full Stripe SDK transport, provider errors or production redaction |
| `tests/db/core-storage-adapters.test.js` | Throwaway independent PostgreSQL pool behavior | Deployment's real migrations, account ownership and production storage |
| `npm run core:evidence` | Disposable offline npm pack file-list, byte count, SHA1 and SHA256 | A retained, tagged, uploaded or verified GitHub Release asset |

## Mandatory before any candidate is published

1. Fetch the current **Stripe main** source and tests, compare all source
   `src/core/*` and relevant original test files against pinned evidence.
   Investigate drift, update reviewed mappings and preserve original assertions
   rather than counting renamed tests as literal parity.
2. For the five unchanged modules, run the complete relevant original upstream
   assertion bodies inside the package with only justified import/fixture
   rewiring. The title/expect-count inventory is a guardrail, not a substitute. K-3s/t/u additionally pin and compare 19 original OAuth, registry, crypto, write metadata and profile portable assertion bodies (one narrowly specified scanner-safe key fixture rewrite). This does not cover the original HTTP endpoint suite or any adapted-service assertions.
   Preserve upstream service-owned assertions in the source service suite.
3. For six adapted exports (profiles, bearer authentication, one-time secrets,
   OAuth protocol, guarded write, MCP dispatch), complete an exact
   input-to-output/error/status compatibility matrix against upstream source.
   Document every intentional boundary change, prove its owning service adapter
   and restore any dropped upstream assertion. No policy inferred from a fake.
4. Run complete offline package-boundary and clean-consumer pack/install tests,
   full `npm run check`, `npm test`, CI throwaway `npm run test:db`, and
   exact-head aggregate `ci` on the final release candidate. Never use live
   passes, production SQL, money transfers or funded resources for these tests.
5. Confirm no service is coupled to the hub; all provider keys, owner login,
   independent authenticated money-out consent, shared-account daily cap,
   SQL lockouts, audit, target ownership, billing/live guards and redaction
   remain inside the adopting service.
6. Finish a reviewed versioned release plan: pin the immutable candidate
   commit, semver, expected Git tag, exact `robinson-mcp-core-<semver>.tgz`
   asset filename, file manifest, byte count and archive SHA256.
   **Do not release a partial core or mark K-3 complete.**
7. Only after every gate is met, create the approved GitHub Release asset.
   Re-fetch the real release by tag via authenticated GitHub REST; confirm its
   target commit, non-draft status, asset filename, byte count and uploaded
   archive SHA256 against the complete candidate, not merely the workflow YAML.
   A digest printed from `npm pack` is **not** remote release evidence.
8. Provide Stripe and Workspace service owners their separate adoption cards.
   Each service verifies its own source tests, OAuth UI, SQL, permissions,
   money guards, startup and CI before opting into a pinned, immutable asset.
   Do not modify those repositories here.

## Failure rules

Missing any assertion, missing durable multi-instance proof, unknown
version/tag, unknown asset digest, altered artifact content, unfinished source
adapter mapping, absent independent money approval or green CI on a different
head means **NOT READY**. Use the existing GitHub REST fallback in
`docs/SESSION-START.md` if this environment has no local Git/npm; never
substitute a fake release response for an actual GitHub Release.

**Next after PR #40:** continue K-3 complete source assertion parity and
adapted-interface matrix, then release prerequisites and real release
verification when actually ready. K-4/H-1 wait for K-3. D-4 remains
WAITING_ON_OWNER independently.
