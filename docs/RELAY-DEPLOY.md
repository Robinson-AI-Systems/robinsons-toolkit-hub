# Relay setup — owner authorized steps only

D-3 implements and tests relay software. **Infrastructure has been provisioned,
but no authenticated agent request has been delivered through it.** Owner
IN-02/IN-03 are applied for infrastructure/repository creation; IN-04 is
partially applied for protected Vercel env entries. Owner IN-06 now approves only scoped D-4 relay configuration and temporary non-production testing; real route acceptance remains open on
GitHub webhook/agent bindings and genuine custom RTC server compatibility.
No real server pass is used by CI. Never paste credentials into chat, a PR, git
or test logs. See docs/pr-cards/D-4.md and docs/OWNER-INPUTS.md.

## Verified owner infrastructure checkpoint — 2026-10-11, PR #86

| Item | Actual verified state |
|---|---|
| GitHub transport | `Robinson-AI-Systems/robinsons-toolkit-relay`, **private**, initially empty; not the source-code repo |
| Vercel source/project | `robinsons-toolkit-relay` on existing Robinson AI Systems Pro plan, linked to `robinsons-toolkit-hub`, Node 24, standard resources |
| Vercel deployment | Build from hub `702d61cf8dc8f46a154ce0ddd0e81ac74f5fcb03` READY; `https://robinsons-toolkit-relay.vercel.app`; **deployment protection enabled**; no live route acceptance |
| Neon | Separate `robinsons-toolkit-relay` Postgres 18 project, existing Launch plan, us-east-1, 0.25 CU capped, five-minute idle suspend, one-hour history |
| Database migration | `relay_seen(request_id, seen_at)` with unique primary key and `relay_seen_age` index, confirmed by catalog read |
| Vercel configuration | `RELAY_REPOSITORY`, `RELAY_PUBLIC_KEY` (nonsecret), and sensitive production-only `RELAY_DATABASE_URL`, `RELAY_PRIVATE_KEY`, `RELAY_WEBHOOK_SECRET`, `RELAY_CLEANUP_SECRET`, `RELAY_GITHUB_TOKEN` present |
| Deliberately unconfigured | `RELAY_SERVERS`, `RELAY_BINDINGS`, signed GitHub webhook, agent issues/grants, scheduler activation, RTC test passes |
| Untested | GitHub token **permission** and actual webhook signature; Vercel ingress under protection; original service RTC adoption; all real D-4 paths |

**Cost boundary:** no paid upgrades or purchases were made, but existing plans
have usage-based charges/allowances. The low-size Neon compute and disabled
unneeded preview deployment are not zero-cost guarantees.

**Crucial distinction:** Vercel builds server code from the **hub** repository.
The empty, private **relay** repository is only for encrypted GitHub issue
comments. The standard ChatGPT connectors were used to provision infrastructure,
never configured as routed tools. Your **custom** `stripe-mcp` and
`google-workspace-mcp` currently expose `/api/mcp`; that MCP endpoint does
*not* by itself satisfy this relay's RTC manifest and `/api/tools/...` contracts.
Do not add them to `RELAY_SERVERS` until genuine service-owned RTC adoption
and read-only tests are verified.

**Next owner/security gates:** verify scoped fine-grained repo token permissions
without revealing token bytes; create GitHub `issue_comment` JSON webhook
against the private repo with SSL verification, and synchronize its signing
secret with Vercel by **rotation** in the same controlled setup (Vercel sensitive
values are not normally readable again). Confirm ingress despite existing
Vercel deployment protection; use narrowly scoped, reviewed authentication or
exception, **never blindly remove site-wide protection**. Set approved server
origins and agent issue/actor bindings only when they are verified. Independently
approve and revoke each short-lived read-only non-production test pass.

## Resources and private scope (original instructions; completed items noted above)

1. After IN-02 approval, create the Vercel project (Node 24, this repo, no framework)
   and a Neon database on the approved plan. Do not upgrade or purchase a plan.
2. After IN-03 approval, create the private `robinsons-toolkit-relay` repository.
   Give each agent access only to this repo. Make one issue per agent/server pair.
   Record issue numbers and immutable numeric GitHub actor IDs privately.
3. Issue a fine-grained repository token with Issues read/write for relay comments.
   No contents/admin permissions are needed. Agent tokens and hosted relay token
   are separate. Revoke any setup-only token after setup.
4. Apply `packages/relay/migrations/001-relay-seen.sql` to the authorized database.
   Database only holds request IDs and timestamps; never persist decrypted data.

## Vercel environment (owner enters secrets privately)

| Variable | Meaning |
|---|---|
| RELAY_REPOSITORY | Private owner/repo |
| RELAY_SERVERS | JSON alias to fixed public HTTPS RTC origin on default port 443; rejects private/metadata literals, internal DNS, embedded credentials, paths and query |
| RELAY_BINDINGS | JSON issue number to **exactly** `{ actorId, server }`; duplicate actor/server grants on different issues are forbidden |
| RELAY_DATABASE_URL | TLS Postgres connection with `sslmode=require` or `verify-full` |
| RELAY_PRIVATE_KEY | X25519 private key, PKCS8 DER encoded as base64 |
| RELAY_WEBHOOK_SECRET | At least 32 unpredictable characters; matches GitHub webhook |
| RELAY_GITHUB_TOKEN | Separate fine-grained one-repo Issues token |
| RELAY_CLEANUP_SECRET | At least 32 unpredictable characters; scheduler-only bearer |
| RELAY_PUBLIC_KEY | Nonsecret matching X25519 public key for provisioning agent client configuration; not consumed by hosted relay runtime |

Generate X25519 keys privately using Node crypto or an approved secure key tool.
Never print/store the private key in agent logs or the workspace; the owner places it
in Vercel. Distribute only the SPKI DER public key as base64url to clients.
Configure only the authorized environment. Previews do not get real passes or keys.

Add a GitHub webhook on the private relay repository to
`https://YOUR_HOST/api/relay/github`, JSON, SSL verification enabled,
**issue_comment only**, secret entered privately. The Web signature handler reads
original bytes; body parsers must not rewrite them.

## D-4 opt-in transport permission probe (post-IN-06)

With protected `RELAY_REPOSITORY`, `RELAY_GITHUB_TOKEN` and `RELAY_BINDINGS` environment values configured in an approved **private** execution environment, run `node scripts/relay-permission-probe.mjs --issue NUMBER --authorized-relay-test` against the assigned test issue. It checks the actual private repository and open, unlocked bound issue, posts a random text marker that **cannot** be decoded as a relay request, then immediately deletes it. Never run without consent to temporary transport comment create/delete. A failed or interrupted cleanup requires a manual issue inspection. No provider read or write, no pass, and no RTC service URL is used by this probe. The command reports only neutral outcome flags. A green result proves those operations on this issue, **not** that the token has no permissions on other repositories or contents; confirm exact fine-grained GitHub token configuration separately. Do not place real tokens in CI or PR logs.

## Signed ingress verification (owner IN-06, opt-in)

In an owner-controlled protected environment, set `RELAY_EXPECTED_INGRESS_ORIGIN` to the exact HTTPS Vercel relay origin and `RELAY_INGRESS_TEST_URL` to its `/api/relay/github` endpoint. If SSO protection requires a narrowly held automation bypass, supply it only through the protected URL setting as `x-vercel-protection-bypass`; never paste it into issue comments, CI, PRs or console logs. Run `node scripts/relay-webhook-probe.mjs --authorized-ingress-test` with the same protected `RELAY_WEBHOOK_SECRET` configured for incoming GitHub signatures. It deliberately sends only edited issue-comment events, which the signed preflight ignores **before DB, GitHub or RTC runtime initialization**; a valid 202 then invalid-signature 401 proves signed ingress but **not** any custom RTC forwarding, GitHub webhook registration or real agent read. Any missing, protected, misconfigured or unmatched ingress reports failure without secret output. A created event still requires the full relay runtime, valid bindings, actor checks, replay SQL and custom RTC authorization. This probe does not disable global SSO/protection. No ingress acceptance is recorded until run with the actual configured Vercel route and owner-controlled signing key.

## Client configuration

Keep `RTOOL_SERVERS` alias mappings and `RTOOL_PASS_ALIAS` as for direct access.
`RTOOL_RELAY` is public JSON with `repo`, `publicKey`, and `servers` mapping
an alias to `{ issue }`. Keep `RTOOL_RELAY_TOKEN` in the agent's secret environment.
The public key must match the owner-created relay key; no fabricated default ships.
No token/pass belongs in servers.json or AGENTS.md.

Every CLI/stdio MCP HTTP door tries direct first. On read connection failure or
proved pre-connect write failure, the encrypted relay is tried; a route notice
appears once per server per CLI invocation (stderr). A service refusal never causes
fallback. A timed-out or reset write may have completed: inspect the server change
log, never blindly repeat. The original server owns confirmation and money approval.
Generated standalone SDKs bundle the same tested relay-capable runtime without storing credentials.

## Hourly cleanup without a paid Vercel cron

The GitHub workflow `relay-cleanup.yml` requests hourly runs at minute 17 and stays
inert until the owner sets repository variable `RELAY_CLEANUP_URL` to the exact
HTTPS `/api/relay/cleanup` URL and secret `RELAY_CLEANUP_SECRET` to the independent
bearer. It needs no checkout or GitHub token permissions. Manual dispatch is available.
Do not configure these until deployment/activation has been approved.
Scheduled GitHub runs can be delayed or disabled after prolonged repo inactivity;
monitor Actions and re-enable/dispatch as needed. No exact cleanup SLA is claimed.

Cleanup verifies the repository is private, visits configured issues only, deletes
request/reply ciphertext older than one hour, and prunes replay IDs older than a day.
The bounded 500-comment cap fails explicitly for manual cleanup; nothing truncates
silently. Recent ciphertext and unrelated discussion survive. Deletion/API/database
failure is reported as incomplete, so the scheduled job fails visibly.

## Verification and recovery

Run local fake tests first (`npm run test:doors`, relay tests and `npm run test:db`).
After separate owner authorization for real test passes, D-4 verifies direct,
GitHub-only relay and sandbox routes and revokes those passes afterwards.
On failed writes or lost replies, the durable claim prevents re-execution. Inspect
server change logs; generate a new request only after verifying the prior outcome.
Rotate the webhook/scheduler secrets independently. Rotate the X25519 pair and
update the public key in every agent before further calls. Disable agent access by
removing its issue binding and revoking its server pass and repo token.

API references checked during implementation:
- https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- https://docs.github.com/en/rest/issues/comments
- https://vercel.com/docs/functions/runtimes/node-js
