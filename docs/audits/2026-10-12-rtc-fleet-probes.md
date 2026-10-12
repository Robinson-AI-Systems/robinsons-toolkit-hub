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
