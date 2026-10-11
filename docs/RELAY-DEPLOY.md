# Relay setup — owner authorized steps only

D-3 implements and tests the relay. It is **not deployed or connected**.
IN-02/03/04 remain open; ask for approval at the actual resource/credential step.
No real server pass is used by CI. Never paste credentials into a chat, PR or git.

## Resources and private scope

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
| RELAY_SERVERS | JSON alias to fixed HTTPS server origin; no caller-selected URL |
| RELAY_BINDINGS | JSON issue number to `{ actorId, server }`; one agent/server pair |
| RELAY_DATABASE_URL | TLS Postgres connection with `sslmode=require` or `verify-full` |
| RELAY_PRIVATE_KEY | X25519 private key, PKCS8 DER encoded as base64 |
| RELAY_WEBHOOK_SECRET | At least 32 unpredictable characters; matches GitHub webhook |
| RELAY_GITHUB_TOKEN | Separate fine-grained one-repo Issues token |
| RELAY_CLEANUP_SECRET | At least 32 unpredictable characters; scheduler-only bearer |

Generate X25519 keys privately using Node crypto or an approved secure key tool.
Never print/store the private key in agent logs or the workspace; the owner places it
in Vercel. Distribute only the SPKI DER public key as base64url to clients.
Configure only the authorized environment. Previews do not get real passes or keys.

Add a GitHub webhook on the private relay repository to
`https://YOUR_HOST/api/relay/github`, JSON, SSL verification enabled,
**issue_comment only**, secret entered privately. The Web signature handler reads
original bytes; body parsers must not rewrite them.

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
