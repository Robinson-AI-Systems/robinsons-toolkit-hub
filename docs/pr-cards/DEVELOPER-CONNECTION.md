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
