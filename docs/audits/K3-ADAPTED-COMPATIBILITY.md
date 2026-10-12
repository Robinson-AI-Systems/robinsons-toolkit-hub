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

## Additional verified source compatibility (partial)

K-3ad also executes all **four** formerly excluded original OAuth endpoint assertion bodies with the unchanged source cases and original pinned source handlers against an isolated in-memory test adapter. It checks full source suite body equivalence, registration, owner-login lockout/TEST-only choice, access expiry, refresh rotation/replay and scoped bearer rejection. These four remain **service-owned**, not counted among the 21 portable cases: the substitute is not the real Stripe source database, authenticated owner UI or multi-instance migration proof. A real original-service CI run and production-safe adoption remain mandatory.

K-3v/w now execute original Stripe MCP bearer, encrypted one-time secrets and OAuth endpoint functions directly alongside portable adapter functions in CI, pinning original runtime Git blobs. This is in-memory differential evidence, **not** source service SQL/owner login adoption. Four service-owned OAuth HTTP endpoint cases, direct original dispatch function tested with fake injected helpers; full source transport and service SQL still missing, final release-candidate evidence and actual GitHub Release remain open.

`node scripts/verify-k3-upstream-drift.mjs` now probes current Stripe main through authenticated or public GitHub REST, compares eleven source files and eight relevant original test suites with the independently reviewed snapshot in `K3-UPSTREAM-BASELINE.json`, and refuses unavailable/truncated/changed evidence. This is an explicit operator-invoked network probe, not a substitute for fresh final-candidate reconciliation, server-owned source tests or release authorization. The earlier eleven source blob hashes were identical on Stripe main `587ad2e9eb7cb2a1e8f3a567c4ec8c827a8ae2f6` (2026-10-11).

## Mandatory before any candidate is published

1. Fetch the current **Stripe main** source and tests, compare all source
   `src/core/*` and relevant original test files against pinned evidence.
   Investigate drift, update reviewed mappings and preserve original assertions
   rather than counting renamed tests as literal parity.
2. For the five unchanged modules, run the complete relevant original upstream
   assertion bodies inside the package with only justified import/fixture
   rewiring. The title/expect-count inventory is a guardrail, not a substitute. K-3s/t/u/z additionally pin and compare 21 original OAuth, registry, crypto, write metadata and profile portable assertion bodies (one narrowly specified scanner-safe key fixture rewrite). This does not cover the original HTTP endpoint suite or any adapted-service assertions.
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

The read-only `node scripts/verify-k3-remote-release.mjs <approved-final-candidate.json>` tool independently verifies an actual published GitHub Release: immutable tag points to candidate commit, asset identity/size/uploaded digest matches the manifest, and the downloaded archive's SHA256/byte size matches. CI uses fake HTTP responses only to prove rejection behavior; no candidate JSON or GitHub Release is manufactured. The actual release is still **absent**, so this verifier is capability, not completed evidence.

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

## Machine-enforced current blocker ledger (K-3ab)

`docs/audits/K3-RELEASE-PREREQUISITES.json` lists eight required gates with owners, reasons and next evidence actions. `npm run check` executes `scripts/check-k3-release-gates.mjs`, checking the private 11-export package, the 21 currently verified exact original assertion bodies, pinned source SHA alignment, missing external proof and this **NOT READY / NOT RELEASED** decision. This does **not** turn synthetic adapters into real SQL/owner consent or certify an asset.

`node scripts/check-k3-release-gates.mjs --candidate` intentionally returns failure while any required service, upstream-drift, adoption or remote GitHub Release proof remains open. That refusal is deliberate and cannot be bypassed by changing a JSON status field; changing publication conditions requires a separately reviewed implementation with authentic remote evidence and all gates met. Do not tag or upload a partial package.

**K-3af source OAuth durable adapter (still not service adoption):** an isolated PostgreSQL schema and independent connection pools now exercise the original Stripe OAuth HTTP handlers with atomic SQL code-consumption and refresh rotation, persisted TEST-only account settings, owner-login lockout and revoked bearer denial. This is stronger than an in-memory fake, but the SQL table names, migrations, owner identity and service routes are deliberately a fixture, not the actual Stripe implementation. Real source service CI, independently authenticated owner money consent and production-safe adoption stay pending.

**K-3ag bearer projector fail-closed hardening:** portable `mcp-auth` now validates and deep-freezes the service-selected identity, refusing echoed bearer text, sensitive claim keys, active getters, prototype-inherited/exotic objects, cyclic identities and an 8 KiB serialized projection limit. A malformed service projector yields the existing generic invalid-token 401, not leaked context. This is an intentional stricter adapter boundary: source service must confirm its authentic claims still fit; service token lookup, account ownership, expiry, revocation and owner money authorization remain outside core.

**K-3ah nested dispatch escalation boundary:** a permissive service profile may legitimately allow a top-level guarded write, but `runRead` now independently rejects every nested tool not explicitly declared `writes:false`. New tests include `writes:true` and missing metadata denials and successful nested declared reads. This is a deliberate stricter adaptation than the pinned Stripe dispatch source; real source authorization, independent owner money consent and service tests still belong to Stripe.

**K-3ai bearer transport and database-failure status:** portable bearer authentication accepts only string Authorization headers (rejects duplicate/header object coercion) and converts durable token lookup failures into generic `503 temporarily_unavailable` without a misleading invalid-token challenge or leaking SQL errors. Missing/revoked tokens still return `401`. The source service must independently confirm its HTTP adapter, migrations and outage semantics; this test cannot substitute service CI or owner's money consent.

**K-3aj live Stripe drift reconciliation:** compared reviewed baseline `587ad2e` against live Stripe `e3c5b34` (five commits ahead). All 11 `src/core/*` blobs are unchanged; two original service unit suite blobs changed only inventory expectations for expanded Stripe account/admin features. Test-suite hashes and exact comparison fixtures refreshed, with separate source/test drift categories. Portable 21 original assertion bodies are not a substitute for the eight complete source-service suites. No owner approval, production SQL or actual release is certified.

**K-3ak single-use setup URL integrity:** portable core requires each service-owned setup route to contain the newly issued opaque id and rejects traversal, encoded dot/separator paths, backslashes and ambiguous double slashes before encrypted persistence. Stripe-style query routes still work. This is an intentional stronger route boundary than source; actual service routing, SQL ownership and expiry must still be verified without relying on the fixture.

**K-3al write confirmation provenance:** portable guarded-write lifecycle reads confirm/dryRun exclusively from own Boolean data descriptors on plain or null-prototype argument records. Inherited flags or getters cannot initiate a money preflight or provider mutation. This intentionally tightens the source semantics; it does not infer authenticated owner consent from a caller confirmation, and server-only shared account limits, durable reservation, source SQL and LIVE checks remain mandatory.

**K-3am authentic Stripe source SQL CI:** Unlike the earlier substitute-schema adapter, the required `stripe-source-sql` GitHub Actions job checks out immutable Stripe commit `e3c5b34` and runs the *original* service-owned OAuth persistent, OAuth, money approval, money reservation and limit SQL tests against isolated PostgreSQL. See `K3-SOURCE-SQL-CI.md` for exact tests and limits. This is independent source SQL evidence at a pinned revision, **not** independently authenticated owner browser approval, a current-main parity certificate, production deployment, or service adoption. Release-gate ledger remains NOT_READY.

**K-3ao throwing HTTP request header boundary:** the portable bearer gate now treats exceptions from reading `req.headers.authorization` as malformed credentials and returns the same no-store 401 as ordinary absent headers, without invoking the database or projector. Ordinary incoming Node headers still work. This intentional source-neutral strengthening does not confer authorization, modify source Stripe transport or prove source service adoption.

**K-3ap exact single-use link identifier:** portable one-time setup path validation now requires exactly one full issued 32-character id either as a pathname segment or parsed query value. Substrings in values/keys and duplicated IDs cannot pass. Existing `/api/stripe/setup?show=<id>` routes remain supported. This does not independently prove that the service uses the correct query name, grants access to the right owner, or enforces expiry/atomic SQL; authenticated service integration remains gated.

**K-3aq original CI evidence preservation:** the new CI provenance guard binds both original Stripe source jobs to the independent reviewed upstream baseline and the nine source DB/HTTP suites. It fails on moving checkout refs, drifted source owners, missing assertions, non-local source SQL or dropped aggregate checks. This complements actual original source execution (#61/#62), without making a **NOT READY** service adapter or GitHub Release ready.

**K-3at stricter dispatch input boundary:** source native MCP requests decode JSON into own-data records;
portable `createGuardedMcpDispatcher` may also be imported directly, so it now rejects active/inherited,
non-enumerable, symbol and prototype-sensitive top-level argument descriptors before authorization or side
effects. Regression verifies plain and null-prototype compatible requests, denied getters and no provider
calls. This is deliberate fail-closed adaptation, not a claim about source HTTP transport adoption.

**K-3au encrypted setup link selector integrity:** the portable store now refuses any repeated
query parameter name whose value carries the issued id (also percent-decoded aliases). That closes a
first-value/last-value selector ambiguity before inserting the encrypted row; unaffected exact source
query convention and path segment tests remain green. The service owns route interpretation,
account-bound authorization, durable one-use SQL and production activation.

**K-3av bearer transport provenance:** the portable MCP guard checks optional Node `headersDistinct`
and `rawHeaders` alongside the normalized authorization string. More than one Authorization field,
conflicting representations or malicious accessors are rejected as unauthorized before durable lookup;
a normal single header still accepts. This is deliberately stricter fail-closed transport behavior than
the source utility; the adopting service must verify its actual HTTP adapter separately.

**K-3aw OAuth request integrity:** Portable OAuth handler parsing now rejects repeated URL-encoded parameter names (including encoded aliases), inherited/accessor/prototype-control request records and accessor redirect URI entries before DB access. The shared HTTP helper remains an exact original-source copy; source service transport/parity and human owner consent are separate, unfinished gates.

**K-3ax scoped page integrity:** After service redaction, the portable MCP layer validates each adapter-produced page as plain inert JSON data. No getter, `toJSON` function, unsafe prototype or cycle can be used during response spread/serialization or before issuing a scoped durable handle. This does not prove the service's original result SQL/retention or real provider response sanitization.
