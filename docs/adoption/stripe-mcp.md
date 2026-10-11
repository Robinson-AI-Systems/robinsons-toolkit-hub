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
