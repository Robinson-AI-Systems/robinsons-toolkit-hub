# Proposed Stripe MCP adoption — **not executed**

Status: **handoff only; WAITING FOR K-3 RELEASE AND STRIPE-OWNED CARD**. Do not change `Robinson-AI-Systems/stripe-mcp` from the toolkit repository. The standalone Stripe server must continue functioning with its own handlers, SQL, account selection and independently authenticated money-out owner consent.

## Source baseline and target exports

At 2026-10-11, reviewed Stripe main `60877ae0058262c09bbbe7bd48970dc1aca6334c`; the `src/core` extraction-relevant files were unchanged since `dca5ad8`. Consult `docs/audits/K3-SOURCE-TRACE.json` for pinned per-file source blobs and exact corresponding core exports. Five leaf functions are byte-identical; six are **adapted**, not proven drop-in replacements.

## Implementation card to create **inside Stripe**, after real K-3 GitHub Release

1. Read Stripe's current `AGENTS.md`, `docs/SESSION-START.md`, current `docs/STATUS.md`, work index, cards and security approvals. Re-inspect source main and any changed `src/core/*` functions, imports, tests and SQL. Do not rely on this stale SHA without recheck.
2. Pin an immutable `robinson-mcp-core-<semver>.tgz` asset URL and its verified SHA256 from the **actual GitHub Release** (not the unpublished temporary tarball). Install without changing Stripe's own ownership of SQL/Stripe SDK/HTTP routes. Never make the server call the hub.
3. Migrate direct pure imports first: `oauth`, `crypto`, `registry`, `http`, `write-contract-check`. Preserve the original assertion bodies (including fake DB helpers and behavioral expectations), and run existing security/unit suites.
4. For `profiles`, inject the source's `listingForConnection`, `isGuardedTestWrite`, test-area, account/mode and selection rules locally. For `mcp-auth`, translate the source durable access-token lookup and service-owned connection projector; all revoked/expired/wrong-account records must be denied before handlers.
5. For `one-time-secrets`, explicitly retain `stripe-once/id/account/mode/kind` AAD, `stripe_account` row mapping and `/api/stripe/setup?show=` URL. Assert existing ciphertext interoperability and atomic consume-once in **Stripe's actual Postgres schema** across two independent pools. Do not silently re-encrypt or invalidate stored secrets.
6. For `oauth-protocol`, retain Stripe owner login, PKCE, client auth, selected profile/mode/listing/account, durable login lockouts and token-refresh carry-forward. New refresh tokens must not expand permissions.
7. For `write`, retain exact idempotency prefix and provider error classification, audit intent before provider operation, independent read-back and uncertain outcomes. **Each money-out action always requires authenticated, operation-specific, independent owner consent** even below the normal $500 limit; retain Stripe-account shared spending safeguards and LIVE disabled until approved. A caller's `confirm:true` is never owner consent.
8. For `mcp-dispatch`, adapt only the trusted authenticated identity, per-tool policy, SDK HTTP transport, service redactors and scoped result DB methods. Test guessed names and indirect calls cannot bypass `read_only`, and no result-store outage truncates or reports success.

## Required verification and rollback

Run the source server's original OAuth, keys, profiles, registry, write-contract, write-core, and MCP tests **plus** relevant mock, Postgres and full CI. Conformance must pass for the actual server and two-instance locks. Compare before/after metadata, auth failures, confirmation prompts, change-log ordering, idempotency, large-result isolation and revocation. Verify zero live provider writes and unchanged money-out owner authorization. Record candidate SHA, release URL/checksum, test evidence, exact-head CI, unresolved reviews and reversible backout. If parity cannot be demonstrated, keep Stripe on its standalone source implementation and report the incompatibility as a K-3 follow-up instead of forcing import substitution.

## K-3cg source-service security handoff — 2026-10-12

At reviewed Stripe revision `4fedb344c732b806dae033f87e936350a1180b77`,
`src/core/http.js` uses JSON.stringify on a framework-preparsed caller
object to enforce 16 KiB. Hub's byte-identical candidate broke OAuth
no-getter/no-toJSON regressions: crafted object accessors ran before refusal.
Hub's **private** module was adapted to descriptor-only bounded inert JSON.
The Stripe MCP service agent should inspect its **current** HTTP/RTC routes
and implement equivalent getter-free preflight and original-service regressions
under Stripe's cards/CI; retain byte-exact host framing and independent owner
money-out/account SQL guards. This is a service-owned action; Hub does not
edit the Stripe repository or claim it adopted the package.

## K-3ch original-service local archive rehearsal (2026-10-12)

Hub CI now runs five unchanged original Stripe assertion files against
the real original service code while the service's four proven verbatim leaf
module imports are temporarily replaced by re-exports from a privately
installed core tarball. This isolated CI-only overlay does not modify or
activate the standalone Stripe repository, and does not replace its durable
Postgres adapters or independently authenticated owner financial consent.

Next action for Stripe agent when repository-approved: inspect the immutable
private artifact and source SHA, adopt only proven stable imports behind a
reversible tested PR, run all original unit/SQL/money approval suites against
that actual adopter and retain standalone autonomy. The HTTP module
still requires a service-owned getter-free request-body review.

## K-3ci immutable installed-core SQL adoption rehearsal (2026-10-12)

Hub's #121 original service checkout SQL job now preserves its pristine source
seven-suite PostgreSQL pass and repeats the seven original SQL suites while four
proven source-verbatim imports route through the unpacked private package.
This is stronger than the earlier five unchanged original unit suites, but
does not make the package a committed dependency of Stripe, exercise the
adapted bearer/HTTP/owner consent adapter through private core or establish
real owner-financial consent. Keep the original server's own migration and
approval gates.

Source review at Stripe main `a38a325f07bdb993b46dc82d85e835d06281aff0`:
compared against Hub's pinned `de56af8199fee39b20c2a1ac733562f2622dfda7`,
four tracked core files differ (`http`, `mcp-auth`, `rtc-http`, `rtc-passes`);
all four overlaid verbatim leaves and eight original tracked unit-suite blobs
remain stable. The current-service agent must review these service-owned
security differences before adoption rather than treating historical green CI
as proof of current compatibility. Release remains blocked.

## K-3cj current-service source/test compatibility handoff (2026-10-12)

Hub source CI replays original Stripe SQL, owner HTTP and RTC suites at
immutable reviewed Stripe `a38a325f07bdb993b46dc82d85e835d06281aff0`;
private archive import rehearsal reruns the original PostgreSQL tests
against unchanged four pure core leaves. The original service-owned RTC
tests now include restrictive TEST-pass area selection, batch-atomic
rate accounting, denial-status accuracy and read-only money-tool
exclusion. Those changed RTC modules are **not** imported into the Hub
library: the service must prove its own actual deployed RTC identity and
TEST-only protected calls before D-4 can accept it.

**Service-owned security review remains:** current original
`src/core/http.js` computes JSON.stringify on framework-preparsed
untrusted objects; Hub's security-adapted portable HTTP rejects
getters/toJSON before serialization. Do not silently substitute the
portable HTTP, and do not claim original-service parity until Stripe's
own HTTP/owner-route tests prove safe inert framing. Human-approved
financial consent, actual account isolation and adoption of an immutable
released package remain mandatory. Current CI source pin is not a release.

