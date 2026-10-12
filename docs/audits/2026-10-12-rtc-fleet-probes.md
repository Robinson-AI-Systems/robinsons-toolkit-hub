# RTC custom-server connection observation — 2026-10-12, start of session

This is **direct deployed HTTP evidence**, obtained with the connected owner's
Vercel deployment URL fetcher. The Vercel team confirmed project-domain
ownership for Stripe, GitHub and Google Workspace. No secret or pass was used,
and no generic MCP connector was treated as the custom RTC endpoint.

| Server | Verified deployed origin | GET /api/contract | Source main reviewed | D-4 state |
|---|---|---|---|---|
| Stripe | https://stripe-mcp-psi.vercel.app | HTTP 200, RTC 1, prefix stripe; conformance pending | e9b5440532e0ac5bb0744741933df62929f54e42 | Manifest reachable; authenticated TEST read unverified |
| GitHub | https://github-mcp-xi.vercel.app | HTTP 200, RTC 0, prefix github | e52a6708beb2aca1c1c194b892a965c06fd37cb1 | Blocked: RTC 1 disabled/nonconformant |
| Vercel | No owner-verified deployed origin | Not probed; no deployment domain in linked Vercel team inventory | 7c1aa810bed8663056d92f6fa9777f22bd71d144 | Unverified |
| Neon | No owner-verified deployed origin | Not probed; no deployment domain in linked Vercel team inventory | aec18761a8b281c5338e79c3a7d895b1e037f144 | Unverified |
| Google Workspace | https://google-workspace-mcp-five.vercel.app | HTTP 404 | 54cbcc78801805560ba94bae3325fee13d41b4f8 | Unavailable at RTC contract route |

**Distinct acceptance gates:** none have proven authorized pass identity, harmless
TEST-only read, direct agent route, encrypted private GitHub relay route,
Vercel Sandbox, pass revocation or complete conformance. A public RTC manifest
is not a verified service connection. Reprobe at the end of this session; this
dated table is not a substitute for future sessions' new HTTP observations.
The private ciphertext-only relay repository and protected hosted webhook
are separate from these service RTC origins.

## Bounded additional session verification (2026-10-12, K-3 batch #116–#120)

At the later session boundary, the committed inventory was reviewed again
against Stripe, GitHub, Google Workspace, Vercel and Neon. **Do not overwrite
the earlier positive HTTP observations in the table above** with an executor
transport failure.

- Stripe, GitHub, Google Workspace: an independent public `GET /api/contract`
  attempt from this session's execution container failed at DNS resolution
  (`curl` exit 6, HTTP status 000 for each); the web fetch context also
  could not access these URLs. This proves **this runner cannot probe**, not
  that the deployed services became unreachable or lost RTC compatibility.
  The earlier observed HTTP 200/200/404 results remain dated, not fresh
  authenticated connection proof.
- Vercel and Neon: public RTC origins are still `null` in the owner-reviewed
  inventory. Neither was guessed or probed by hostname. Coordinate each
  service's exact deployed TEST RTC domain and protected mode contract through
  that service repository handoff before adding them.
- No owner-issued temporary TEST pass was available in this execution
  environment, so **zero authenticated TEST direct reads** were attempted.
  Neither encrypted private GitHub relay, Vercel Sandbox nor same-pass
  revocation was executed. D-4 remains **IN_PROGRESS**, not accepted.
- Re-entry: run `scripts/probe-rtc-fleet.mjs` from a network-capable,
  owner-approved executor with fixed verified origins; provide temporary
  service-issued scoped TEST pass through protected environment only.
  Then collect four separate neutral direct/relay/Sandbox/revocation results.
  Existing IN-06 approval is sufficient for its restricted scope; no repeat
  approval request or security weakening is authorized.
