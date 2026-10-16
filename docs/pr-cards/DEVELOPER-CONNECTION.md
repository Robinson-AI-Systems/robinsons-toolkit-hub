# Reusable developer connection — owner authorized 2026-10-13

## Outcome and boundary
Let the implementing agent connect once, retain its developer authorization securely,
refresh access and run approved tests without repeated owner-page pass creation or copying.
This does not restrict the production MCP catalog, supported operations or runtime profiles.
Development authority applies to the implementing/testing agent and approved test resources;
it is not a blanket read_only restriction on the finished product. Full test profiles remain
available for genuine fixture writes; independent money-out, paid capacity, live activation,
production data destruction and resource-isolation gates remain unchanged.

## Integration and acceptance
- Reuse native OAuth code + S256 PKCE, existing owner consent and refresh/revocation logic.
- Mobile owner opens one prefilled link; no bearer or account ID copied through chat.
- Credentials remain in protected client storage, never MCP tool results or instructions.
- Expired access refreshes within the existing grant; revoked/invalid grants require consent.
- Each standalone service remains usable without Hub; rtool manages multiple connections.
- Native MCP testing uses the connected developer principal and existing write guards.
- Separate source, offline tests, deployed revision and real provider/scratch acceptance.

## Resume
Implemented mobile PKCE/RSA authorization handoff in each standalone service and native
rtool OAuth connection/refresh/check/call commands in Hub's CLI. Product catalog/profile
filters unchanged. New service-owned developer_oauth_handoffs table is additive and lazily
initialized by the developer endpoint, separate from native provider/account storage.
Unit/CLI tests run locally; SQL race/expiry tests require disposable CI Postgres.
CI provenance guard separates standard connectors and custom-service proof. Exact-head CI,
reviewed deployment, initial owner consent and real provider/scratch acceptance pending.

## Role-drift and completion review
Read docs/reviews/2026-10-13-completion-recovery.md. Review the actual source/index
before extending scope: preserve full product capability, isolate builder permission,
use the native custom service for acceptance, and finish finite supported workflows.

## Connection review corrections — 2026-10-13

Authenticated polling retries return the same encrypted authorization code until the
original request expires; native OAuth token exchange remains single use. The trusted
service client-IP helper and atomic per-IP SQL counter enforce concurrent start quotas.
Backend outages return retryable 503 instead of malformed-request 400. Native 32-character
Google authorization codes are accepted, and its consent page retains the requested
profile while leaving the final choice to the owner.

Evidence must explicitly track all eight layers exactly once. Deployment-provider metadata
can prove only deployment; runtime acceptance must use the actual custom-service transport.
Full provider acceptance includes permitted reads/writes, resource and identity denial, and
provider readback. Schema validity alone supplies none of these observations.

Regression tests cover these failures; exact PR CI and real provider acceptance are separate.

Windows developer records use bounded Credential Manager chunks and a short atomic
manifest, keeping RSA pending credentials below the per-entry blob limit. Managed POSIX
runners use a kernel flock held by a child pipe; abandoned lock filenames do not block
future sessions. Secrets stay in protected OS storage or the explicit encrypted runner vault.

Follow-up review: completed handoffs remain immutable until expiry even if another process
starts setup for the same client. Hub acceptance requires a Hub-mediated RTC route and
its readback; standalone MCP initialization or a bare service RTC request is insufficient.

## Live refresh correction — October 13

Authentic Google token refresh retains the existing refresh token and omits it from
the response. The CLI now preserves it only for an already connected principal; newly
authorized connections still require an initial refresh token, supplied rotations replace
it, and malformed supplied values are refused. Original grant settings remain server-owned.
Real GitHub/Google consent and authenticated initialization passed; Google Gmail identity
readback and GitHub selected scratch-organization reads passed. Full provider, hosted Hub,
revocation and owned scratch cleanup acceptance remain separately tracked.

Partial standalone evidence is recorded separately in developer-evidence.json. It cannot
close hosted Hub or complete-provider layers. Google original Calendar CRUD verified an
isolated tagged event create/read/delete without notifications. The temporary secondary
calendar vanished from CalendarList after delete, but metadata readback still returned
it, while subsequent ACL and event reads returned notFound, independently confirming
owned cleanup. The immediate server-side metadata confirmation still needs correction. Dedicated RTC fixture
helpers require separate TEST authority; native full-profile provider tools retain their
original functionality. No GitHub repository was created because current default-label
cleanup restrictions would risk leaving an uncleanable fixture.

## Hub connection and durable runner recovery
Migration 007 supports fixed callback developer clients and encrypted PKCE polling. Hub owner consent retains the requested developer profile in TEST mode; ordinary OAuth remains unchanged. The server has no added production/provider operations. Initial owner setup uses a private, expiring activation link configured through the owner-authorized control plane; once saved, the verifier cannot be replaced through that link.

For this Repo Management runner, the protected checkpoint lives in the existing Hub Vercel project (the verified chris-projects-de6cd1bf team), Development-only encrypted RTOOL_BUILDER_SESSION. Retrieve only that named variable through authorized Vercel control-plane tools, hydrate a new private vault using restoreDeveloperCheckpoint with independently configured exact origins, run one serialized runner, then saveDeveloperCheckpoint through the same protected store after credential mutations. Never display its value, commit it, save it in Library, treat a checkpoint as proof of consent, or let concurrent runners share rotating tokens. Record nonsecret status only. The store adapter is required to fail rather than claim persistence if it cannot save.

## Browser form parser correction
Vercel supplies parsed request.body objects for application/x-www-form-urlencoded forms (https://vercel.com/docs/functions/runtimes/node-js). Accept Object.prototype and null-prototype dictionaries, retain scalar/size/duplicate checks and reject inherited objects. Local tests use actual node:querystring.parse through the real setup route; no production credentials are used or changed. Preserve the existing activation and saved developer connections.

## Agent connection recovery when private plugin tools are absent

The owner's phone/Android client is not a reason to repeat provider setup or to stop
custom-service acceptance. A private plugin's tools being absent from this conversation
is distinct from missing provider credentials, expired access tokens, revoked service
grants and a runtime that cannot issue HTTPS requests.

1. Read this card and inspect this conversation's actual terminal/HTTP capabilities.
   If a native custom-service tool is callable, use it. Otherwise use the existing
   rtool native developer client against this service's verified deployed OAuth/MCP origin.
   A cloud agent runtime can do this while the owner stays on mobile; the owner's PC
   is not the runner. Standard provider connectors remain infrastructure tools only.
2. The shared client is in Robinson-AI-Systems/robinsons-toolkit-hub:
   packages/cli/bin/rtool.js and packages/cli/src/{developer-client,developer-vault,developer-checkpoint}.js.
   Configure RTOOL_SERVERS with this service's alias and independently verified exact
   origin; use OS keychain storage or RTOOL_DEVELOPER_VAULT_DIR in a private non-Git directory.
   Run developer-check, developer-tools and developer-call using the syntax below.
   These developer commands call the standalone service directly; they do not require
   Hub federation to be finished.
3. For the coordinating Repo Management runner, six saved native grants are retained in
   the existing Hub project's Development-only encrypted RTOOL_BUILDER_SESSION checkpoint.
   Retrieve only that named secret through authorized Vercel control-plane tools,
   privately restore an empty vault with restoreDeveloperCheckpoint and exact-origin
   validation, then saveDeveloperCheckpoint after token changes and before stopping.
   Never print, commit, attach, place in Library or send credential values to another chat.
   See Hub's DEVELOPER-CONNECTION card for the existing recovery procedure.
4. **One serialized runner owns that checkpoint.** It is not a concurrent shared token
   pool. Do not restore stale checkpoint copies over newer local credentials or run
   independent agents against the same rotating refresh tokens. A different agent
   coordinates acceptance with that runner, or uses its own separately authorized grant.
   Persist approved test evidence in the relevant repository so implementing agents can
   use it without receiving credentials.
5. Expired access normally renews with the saved refresh grant. An authentication failure
   alone does not prove owner consent is lost: check exact origin, deployment protection,
   saved record freshness and refresh outcome first. Avoid testing renewal by setting the
   client clock in the future against a live server: that can save an inaccurate expiry.
   If a saved access expiry is known stale, renew through developerAccess using actual
   current time and persist the replacement. Never replay a possibly executed mutation.
   Request new consent only after a genuine revoked/invalid grant or added authority is proved.
6. If this particular conversation has neither native custom tools nor an HTTPS-capable
   execution runtime, report that specific limit and coordinate the required run/evidence
   with the existing runner. Do not ask the mobile owner to install a desktop plugin,
   copy passes, reconnect the underlying provider, or certify a test the agent cannot run.

Commands below run from a checkout of the shared Hub CLI, with this service's exact
origin and protected vault configured. rtool can also be used when installed. The CLI
server alias must match the existing saved record; a renamed alias is a different record.
Deployment protection, where present, requires its authorized exact-origin access
in addition to service OAuth; do not disable protection or switch to a convenient alias.

```sh
node packages/cli/bin/rtool.js developer-check hub
node packages/cli/bin/rtool.js developer-tools hub
node packages/cli/bin/rtool.js developer-call hub hub_whoami --args '{}'
```

Initialize/tool discovery/identity, provider reads, fixture writes/readback/cleanup,
scope denial, renewal/revocation and Hub federation are separate evidence. Record
the exact deployed revision/origin before claiming real acceptance. Successful standard
connectors, source CI, mock providers or another service's connection prove none of
this server's independent acceptance. Preserve its complete product catalog and all
existing operation-specific approval/isolation/spending gates.

### This repository's purpose and first identity check

Optional single-connection gateway, bounded discovery and routing. Test Hub identity separately, then prove real upstream RTC dispatch/readback, private relay, Sandbox and revocation where required; standalone initialize does not prove federation.

Use `hub_whoami` through this service's own saved `hub` grant. The six connections were directly rechecked by the coordinating runner on October 13, 2026; all six authenticated initialize requests succeeded without desktop plugin activation. That transport observation does not complete this repository's provider/write/RTC/Hub acceptance. Current grants were saved after renewal; reverify actual identity, scope and deployed revision on the next run.

## 2026-10-15: approved owner-passphrase recovery

The previous one-time setup link was not a password-reset link. The hosted Hub
already contains one owner scrypt verifier, but the owner reports they do not
know the passphrase and explicitly approves replacing it. The normal protected
owner login must not be disabled. The optional `HUB_OWNER_SCRYPT` override must
remain unset while the original database verifier is authoritative.

Source repair adds the mobile-friendly `/api/owner/recover` form and migration
`021-hub-owner-recovery.sql`. A fresh Vercel **Production sensitive**
`HUB_OWNER_RECOVERY_CODE` (43 URL-safe characters generated by the owner in
their password manager) and production `HUB_OWNER_RECOVERY_EXPIRES` (UTC ISO
expiry, never more than 72 hours ahead) gate all requests. The owner inputs
that code and a new passphrase only into the HTTPS form, not ChatGPT/GitHub.
Every recovery code is transactionally spent by a keyed digest and the new
verifier written atomically; 5 tries/15m global owner budget, plus per-peer
rate limits, prevent guessing. The existing verifier survives failures.
Recovery does not automatically revoke existing developer OAuth sessions;
security review and selective session revocation remain separately gated.

Release and acceptance: source CI is not a new working login. Deploy the exact
reviewed code via the existing daily checked policy, apply migration 021
with independent readback, confirm serving Vercel env and URL, have the owner
submit their own protected browser form and verify owner login. Remove
the temporary env variables after successful setup. No credential is printed,
no owner database row is deleted, no provider LIVE grants are altered, and no
manual release is authorized solely by this maintenance request.

## Protected production URL compatibility (October 15)

Vercel Deployment Protection inserts a temporary access query parameter to
serve the private owner recovery page. The previous ownerRecovery GET rejected
all query parameters, producing HTTP 400 even with valid owner recovery
configuration. Recovery GET is deliberately inert: ignore untrusted query
parameters entirely, never interpret them as approval, and never reflect
them into the HTML. The POST still requires the exact one-time Vercel
production secret, owner-global rate limiting and transactional DB rotation.
Owner-facing setup should never require manual RTC registry or grant IDs.

## Owner-facing Workspace onboarding replacement — October 15

New `/api/owner/connect-workspace` is the main owner action rather than
manual `/api/owner/servers` then `/api/owner/grants` then
`/api/owner/verify-grant`. In the first phase only the Hub owner passphrase
is required; the service origin, exact RTC server/prefix, TEST mode and
non-writing guard are code-defined and checked over pinned HTTPS. A
read-only service-owned Workspace pass is independently required before
routing, and can be entered once into the SAME password-protected page.
The Hub does not mint or bypass a Workspace pass.

Given a separately issued TEST/read_only credential, the single protected
owner submit gets the real service whoami via socket-pinned TLS, validates
the permitted provider areas, identifies exactly one eligible unrevoked
Hub OAuth TEST caller (ambiguous/missing callers fail closed), stages the
pass encrypted, and performs real pinned activation. No manual UUID, server
name, RTC prefix, HTTPS origin, or comma-separated area list is requested.
Every provider authority remains constrained by source pass scopes and
Hub caller areas/profile. Existing conflict/disabled target, invalid write
pass or probe denial must fail without reauthorizing a working grant.
Existing advanced forms remain for manual recovery and fleet administration;
they are not owner onboarding instructions.

A Vercel share/bypass query on either owner-facing GET is ignored and never
reflected into HTML. All POST forms authenticate with the stored owner
passphrase and retain exact source grant authorization and crypto. Provider
pass issuance, genuine network readback, multi-service D-4 acceptance and
checked serving deployment remain separate pending tasks, not simulated
by the new streamlined UI.

## October 16 — preflight for the next checked production release

The Hub main branch is still ahead of the production/live branch. The actual
Google Workspace RTC public contract on source revision 5c23755 confirms
server `google-workspace-mcp`, prefix `workspace`, RTC 1, and 382 advertised
tools. Its admin API retains separate credential issuance; connected native
provider tools are not a substitute for an independently issued Hub-scoped
read-only TEST pass. A read-only count on the provider's own TEST pass store
shows **no unexpired for_hub read_only credentials**. Never invent or create
one through direct SQL, expose a token hash, print a token or confuse
existing non-Hub passes with an authorized Hub grant. The owner must
independently approve service-owned issuance using the protected Workspace
owner pass page; the raw pass is shown only once and goes directly to the
Hub's encrypted, password-verified owner onboarding page, not into chat.

An existing Hub OAuth developer connection is refreshable and one active
session was observed after genuine authenticated Hub tool access; session
liveness must be rechecked during protected onboarding, not assumed from
this preflight. Hosted migration 020 has been applied with both canonical
CHECK constraints VALIDATED and the prefix constraint unchanged. Migration
021 is also installed, recovery code has not been consumed, and the owner
has not yet saved a replacement passphrase. No manual release is approved.

Disposable database integration tests now exercise the real approved
Hub authorization code, OAuth session, 020 schema, server staging, grant
sealing, independent upstream pass identity shape and activation/decryption.
They do **not** claim to perform a live upstream authenticated read. The
pre-release bridge must keep all acceptance for owner-form authorization,
Workspace TEST whoami, live tool read, restricted denial and revocation
OPEN until a real credential is supplied and exact deployed revision is
verified. Full hub routing can become live only once the owner grants the
separate service permission. Daily checked promotion remains mandatory.
