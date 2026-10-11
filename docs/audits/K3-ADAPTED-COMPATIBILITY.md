# K-3 adapted-interface source compatibility ledger

Status: **IN PROGRESS — not a release certification**. Source: `Robinson-AI-Systems/stripe-mcp` at reviewed main; provenance and local blobs are pinned in `K3-SOURCE-TRACE.json`. Service-owned tests stay in service repos. A fake policy result does not establish provider/production authorization.

| Adapted export | Source input/output invariant | Portable evidence | Outstanding service-owned proof |
|---|---|---|---|
| `profiles` | `read_only` never permits writes; explicit read metadata, `everyday/full` visibility; internal write/area/profile hints hidden | Four *unchanged original assertion bodies* pinned in upstream profiles snapshot, plus profile-to-dispatch denial matrix | `listingForConnection`, compact names, test-area allowlist, actual source MCP routes/home counts |
| `mcp-auth` | Exact Bearer grammar; source 401 challenge, invalid token denial; connection tied to durable account and mode | Executable original-source bearer module differential plus `mcp-auth.test.js` and `oauth-compat.test.js` | Actual source database/token row lookup, expiry, revocation, authenticated result scope |
| `one-time-secrets` | 32-char one-time ID; source Stripe AAD `stripe-once/id/account/mode/kind`, encrypted consume-once | Bidirectional original-source ciphertext/AAD differential, adapter tests and disposable DB integration | Source route, account row/atomic SQL/expired ciphertext interoperability |
| `http` (verbatim helper) | Public origin, parser, response and method gate are source-identical | Direct original HTTP blob differential for invalid input, 405, escaping and headers | Source OAuth endpoint suite owner UI/SQL and complete HTTP assertion bodies |
| `oauth-protocol` | Registration, PKCE, token grant, refresh and client binding; no claims invented by core | Direct original OAuth HTTP handler differential (metadata, registration, grant/refresh/error statuses) plus protocol/compat and SQL fixture tests | Actual Stripe OAuth owner UI, durable refresh/lockout SQL, source HTTP endpoint regression |
| `write` | Confirm/preview/audit/idempotency lifecycle; definite refusal vs uncertain outcome | Existing write-safety tests | Independent authenticated owner money-out consent, shared daily limits, provider idempotency, read-back |
| `mcp-dispatch` | Authenticated tool allowlist; redacted bounded output and scoped durable result handles | Existing dispatch-compat tests | Actual transport, source proxy/formatError, result SQL, provider error redaction |

## Matrix acceptance rules

- Test input, call count, HTTP status/envelope, stored row and forbidden side effect for each relevant source case.
- Original source cases requiring Stripe imports are not copied as if portable; the source suite stays authoritative.
- A service's account/mode/profile selection is never inferred from MCP arguments.
- No release or adoption claim until every pending cell is verified by actual server tests, source-drift review and the complete gates in `K3-RELEASE-GATES.md`.

**K-3y source write matrix:** Original `src/core/write.js` is now pinned and directly executed against portable lifecycle fixtures: preview, confirmed/unconfirmed, owned target, LIVE denial, source-compatible audit/preflight, failed apply and read-back. The portable malformed-money refusal is a deliberately stricter boundary. Service owner consent, account/day ledger, actual provider retries and migrations are still outstanding.
