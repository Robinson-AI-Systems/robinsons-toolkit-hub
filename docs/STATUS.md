# STATUS — current work, blockers and next action

## H-1 encrypted scoped results (#140 proposed; source/SQL only)
Adds true isolated-SQL tested AES-256-GCM-at-rest 24h result handles, HMAC opaque handle digests and exact owner/caller-bound 4KiB base64url byte pages. A no-store HTTPS pass-only GET reauthenticates each page so revoked/expired Hub passes cannot read. Additional HUB_RESULTS_KEY must be separately configured securely; its absence disables result storage only, without disabling other Hub doors. No provider result created or routed, RTC manifest remains 0. H-2/H-3, real hosted TEST read/denial/revocation, completed conformance and measured scale remain open. #136–#139 merged with exact-head checks.

## H-1 constant-size MCP broker foundation (#139 proposed)
Seven actual implemented, read-only Hub broker tools now offer scoped search, describe, local-only call, bounded batch and truthful namespace information alongside whoami/health. Only two Hub-owned harmless leaf reads are currently callable; no provider schema is fetched or provider credential accepted. No recursive broker routing or per-service tool registration; list size fixed across synthetic counts 2/5/12/50/100 (not a real scale/RSS benchmark). Server negotiates supported pinned MCP versions, including 2025-11-25. Public RTC manifest remains RTC0: this source slice is not full conformance or authenticated hosted acceptance. #136–#138 merged exact-head green; H-2 registry and H-3 actual federation remain unimplemented.

## H-1 OAuth revocation and replay safety (#138 proposed; source only)
Adds OAuth client bearer revocation with neutral responses and atomic durable rate-limit, spent-refresh family compromise revocation, and independently owner-authenticated session listing/family revocation. Disposable PostgreSQL exercises real rotation, replay, client-bound and owner-bound revocation. Form parser rejects duplicate/oversize params. Hosted exact revision, real owner setup, RTC1 and protected TEST integration remain OPEN; no real tokens, service grants or provider actions used.

## H-1 owner-only one-time Hub pass setup (#137 proposed; source only)
Adds a no-store/CSP verified-owner browser endpoint to issue a *fixed* 24-hour TEST/read_only/gateway-only Hub pass and independently revoke by pass identifier. A secret is displayed exactly once to its authenticated owner in the immediate HTTPS response and is never persisted raw or put into repository/PR/logs. Owner account and live host remain unconfigured/unverified; no pass was actually provisioned or displayed in this implementation session. Existing SQL issuance/revocation and lockout are reused without a new live activation. RTC remains 0; remaining RTC1 conformance and two-service acceptance are open. #136 merged exact-head CI green. 

## H-1 HTTP tools continuation (#136 proposed; source only)
Added guarded Hub-only GET search/describe, POST harmless read/batch and public bounded OpenAPI reference. HTTPS passes must have TEST gateway area and no write permission; absent or out-of-scope passes fail closed. Upstream provider dispatch stays disabled, and RTC public manifest remains 0; hosted exact deployment, complete RTC1 conformance, genuine authenticated TEST two-service reads, denial, revocation and scale remain OPEN. No direct/local commands or service repos changed. Required exact-head GitHub CI/SQL and self-review must precede merge.

## Four-PR H-1 batch #132–#135 (implementation only, 2026-10-12)
#132: Hub SQL caller identity, hashed passes, revocation, durable rate-limit/audit foundation; #133: persisted exact-client PKCE S256 OAuth, rotating refresh with original scope and family revocation; #134: source hosted OAuth-gated fixed two-tool MCP/HTTPS entry; #135: owner-scrypt login, exact OAuth client registration/consent, shared 5-in-15-minute lockout and OAuth metadata. All target real, tested code; none of these are real hosted acceptance. H-1 IN_PROGRESS and public manifest remains RTC 0 until complete RTC 1 contract, owner configuration and real tests. Next: finish H-1 connector and RTC doors, then H-2 scoped encrypted upstream grants/durable audit before H-3 federation and genuine two-service TEST denial/revocation. K-3 OPTIONAL, no publication. This repository did not activate live or spend money.
Real deployed service aliases independently inspected via owner Vercel deployment metadata on Oct 12: Stripe production alias at b45c2478d6407071b29a61680f437c012ee6aa84 READY; Workspace at 171144d223f878b2541a055337ece845b591b998 READY; GitHub at e52a6708beb2aca1c1c194b892a965c06fd37cb1 READY. These are older than current respective sources. Vercel READY does not prove protected read_only TEST pass, live Hub, RTC1 or provider read.

## H-1 owner-authorized OAuth bootstrap (PR #135 proposed; 2026-10-12)
Owner-only login via scrypt passphrase verifier, shared PostgreSQL 5-attempt/15-minute lockout, exact client registration, registered-redirect S256 consent restricted to TEST read_only, HTML CSP/no-store, and OAuth discovery metadata. An owner must independently configure actual host origin, owner id, verifier, DB and HMAC key before these doors are usable. **No real configured owner account, external MCP agent, deployed exact commit, federation, provider TEST reads or RTC1 acceptance claimed.** Source and CI are separate from host integration; H-1 remains IN_PROGRESS pending deployment and RTC 1 conformance.

## H-1 hosted transport source (PR #134 proposed; 2026-10-12)
Fixed two-tool real MCP entry (`hub_whoami`, `hub_health`), OAuth-token-only MCP authentication, separate Hub-pass whoami, SQL rate enforcement, bounded runtime Postgres pool and OAuth token-exchange API. Public contract reports rtc:0 until complete RTC 1 conformance. Owner consent UI, approved provisioned DB/config, deployed exact commit, public MCP interoperability and any two-service TEST calls remain unverified. No federation or production activation.

## H-1 OAuth security continuation (PR #133 proposed; 2026-10-12)
Adds PostgreSQL-bound OAuth 2.1 S256 authorization codes, registered-client exact redirects, one-time refresh rotation preserving read_only/TEST/area settings, family revocation, and real throwaway SQL tests. Issuance requires an independent verified owner; **no public owner OAuth consent page or deployed connector acceptance exists yet.** H-1 remains IN_PROGRESS; PR #132 merged with exact-head checks.

## H-1 implementation checkpoint (PR #132 proposed; 2026-10-12)
Hub-owned PostgreSQL caller passes, HMAC digests, one-time issuance behind a verified-owner internal boundary, immediate revocation, shared SQL request limits and append-only forwarding-audit foundation are implemented with isolated SQL fixtures. **No public issuing endpoint, OAuth connector, hosted MCP routing, scoped upstream grants or genuine deployed TEST integration yet.** H-1 IN_PROGRESS, source/SQL CI pending. Hosting remains checked daily live-only promotion, no manual production deploy and $0 autonomous spending.

## Current gateway recovery priority — 2026-10-12

Owner-requested documentation repair; see [source review and acceptance plan](audits/2026-10-12-gateway-architecture-recovery.md).
H-1 is READY after K-1/K-2/D-2; K-3 no longer blocks hosted gateway work. Next: H-1 secure foundation,
H-2 scoped registry, H-3 bounded federation and a two-service real TEST vertical slice. Minimum grant narrowing
and forwarding audit are required in that slice before exposing calls; H-4/H-5 expand them later.
Existing local MCP has six brokers per service, not a constant-size scalable menu; hosted Hub remains unbuilt.
K-3 PRIVATE/NOT_READY, publication/adoption OPEN; D-4 independently OPEN for authenticated routes/revocation.
Older `Next` entries below are historical checkpoints, superseded for priority by this section.
No deployment, credentialed acceptance, scale measurement, LIVE or package release is claimed by this repair.

Updated 2026-10-12. RTC 1 conformance, direct rtool commands and SDK/agent setup are built;
the central hub server is not yet built; relay deployments have varied between READY and a Git source fetch ERROR, and no real agent route is certified.

## Next

**L-1 confirmed conditional local file updates, PR #130 (as-if merged; CI pending):** Four earlier useful slices #126–#129 merged with required gates. A locally opted-in agent may read a bounded SHA-256 and request a confirmed text-file replacement only if the supplied expected hash matches, a cooperative lock is acquired, and the unchanged file is rechecked before staged atomic rename. Real filesystem regressions cover success, stale hashes, lock conflicts, symlink escapes, invalid roots, Git metadata refusal and oversized input. This is not a kernel-atomic CAS against noncooperating writers and does not enable general shell. K-3 remains PRIVATE/NOT_READY and D-4 protected TEST is unverified; new upstream Stripe #190 must be rechecked after its merge, not treated as adopted from an open PR.


**L-1 local source search / PR #129 (as-if merged, CI pending):** Owner-opted-in local MCP adds bounded literal code search without external shell or network. Real temporary-filesystem tests cover matching lines, symlink avoidance, ignored private/dependency paths, scope refusal, match caps and incomplete-result signaling. Existing #126–#128 already merged. L-1 general shell remains pending safe confinement and confirmation; K-3 release and D-4 authenticated acceptance remain independent and unverified.


**L-1 confirmed create-only local files / PR #128 (as-if merged, CI pending):**
After #126 and #127 merged with full exact-head CI, owner-enabled local MCP
can now create new UTF-8 files only with explicit confirm, exclusive
create-only access, canonical approved-directory checks, size caps and
a metadata-only response. Existing content cannot be overwritten; no
general shell, deployment change or external provider operation is enabled.
Real temporary filesystem tests exercise successful create, refusal without
confirm, traversal/outside symlink, Git metadata denial, existing-target
refusal and Unicode byte cap. L-1 remains IN_PROGRESS until shell boundary
and any approved full acceptance are genuinely satisfied. K-3 remains private,
NOT_READY, unpublished; D-4 protected direct/relay/Sandbox/revocation is open.


**D-4 owner Vercel deployment-source cross-check (2026-10-12; provider read only):**
The owner-connected Vercel deployment metadata establishes the actual
production-alias build revisions (not merely a service self-report):
Stripe `stripe-mcp-psi.vercel.app` READY at
`b45c2478d6407071b29a61680f437c012ee6aa84` (reported build ref
`ai/gpt6/daily-live-promotion-166`), Google Workspace
`google-workspace-mcp-five.vercel.app` READY at
`171144d223f878b2541a055337ece845b591b998` (main), and GitHub
`github-mcp-xi.vercel.app` READY at
`e52a6708beb2aca1c1c194b892a965c06fd37cb1` (main).
These differ from newer October 12 source revisions. No verified
Vercel/Neon RTC deployment origin was discovered in the inspected Vercel
project list; their tracked origins stay null, not guessed.
The provider metadata does **not** prove the service manifests' own
claimed revision, verified TEST pass identity, authenticated direct read,
private GitHub relay, Vercel Sandbox, or same-pass revocation.
Under #125 rules, any pass-bearing fleet read remains refused until an
independent exact deployed SHA/ref/environment match is established.
Do not manually deploy in place of the scheduled checked live workflow.

**L-1 Git inspection / PR #127 (as-if merged, CI pending):**
PR #126's fully checked opt-in read-only file tools merged at
`0d96459720b2fe28c88eaab9d2abcc4465ba99e2`.
This coherent next slice adds fixed, bounded, no-shell Git status/diff/log
only inside a canonical owner-enabled folder with an actual local .git
directory; linked/external metadata, arbitrary commands, oversized
output and alternative roots are refused. The complete shell execution
capability remains unimplemented pending an adequate folder confinement
boundary and confirmation policy. This is still L-1 IN_PROGRESS.
K-3 private/NOT_READY and D-4 authenticated routes remain separately open.


**L-1 read-only local file tools (PR #126, as-if merged):** D-2 is
merged; source/deployment evidence still gates K-3/D-4 acceptance.
Opt-in `rtool mcp --local FOLDER[,FOLDER...]` adds canonical-folder-scoped
file_list, file_stat, file_read; no local tools in default MCP or hosted Hub.
Shell and Git remain distinct unimplemented guarded slices. The new
source/tests include a real CLI stdio opt-in smoke. Exact-head CI/review are
required before #126 merge; the whole L-1 shell/git milestone remains open.
Stripe #188 merged in its service repo, adding original OAuth/private-core
proof; service write/dispatch, adoption, package release and all genuine
protected D-4 routes/revocation remain independently pending.


**D-4 pinned TEST deployment preflight / PR #125 (as-if merged, CI pending):**
the public CI fleet report now retains only valid nonsecret deployment
SHA/ref/environment claims; the opt-in credential-backed fleet runner
requires a separately verified exact pin before dispatching a TEST bearer
to the existing agent-check. No pin, stale SHA, source-vs-live, preview,
or malformed public claim is accepted. This remedies real previous
absence of an exact deployed identity gate after #123 revealed RTC1
public endpoints without authenticated acceptance. Public claims are
self-reported, not verification of owner-controlled Vercel deployment,
actual credentials or route. CI synthetic verification only; keep D-4
direct/relay/Sandbox/same-pass revoke and K-3 adoption/release open.
#124 merged at `c789dcfc4b52bebf49a69dda76f16ace32dd36e5`
with exact-head CI green. Four substantial PRs (#121–#124) merged in
the resumed batch; this substantive #125 is the fifth if CI passes.


**D-4 safe TEST read tool namespace / PR #124 (as-if merged, CI pending):**
GitHub-hosted public probe #123 established the actual Google Workspace
contract advertises `prefix=workspace_`, while both Hub read-only TEST
preflights incorrectly required `workspace__`. A shared delimiter-aware
namespace checker now retains strict prefix ownership but permits valid
service tool names; original safe metadata, TEST identity, pass and
exact-route checks remain mandatory. CI fake-service proof only; real
authenticated deployed read, relay, Sandbox and revocation unverified.
#123 merged at `298cf3433ebde2baf6edaadda34bac2bfe8f4c02`:
public Stripe RTC1, Google Workspace RTC1 and GitHub RTC0 (deployed
implementation mismatch), while Neon/Vercel have no verified direct origin.
Stripe K-3 adoption work is concurrent in service repo, Hub core NOT_READY.
No D-4 owner approval re-request required.


**D-4 public deployed fleet observation / PR #123 (as-if merged, CI pending):**
the normal CI check job invokes pinned-inventory public-only RTC contract
probes from a GitHub Actions runner, addressing this executor's DNS limitation.
A failed hosted public endpoint becomes classified, never accepted; no
bearer, runtime URL override, provider read or production change is used.
Capture actual exact-head public HTTP results from CI; they do not prove a
deployed TEST account identity, direct authenticated read, encrypted private
relay, Sandbox or same-pass revocation. Owner IN-06 already approves scoped
TEST work. **Owner blocker correction:** investigate and remedy available
code/config/dependency/docs issues first; isolate external proof per operation
and continue approved independent cards. Stripe package adoption remains with
the Stripe agent; K-3 stays NOT_READY; H-1 order is unchanged.


**K-3cj / PR #122 as-if-merged (exact-head CI required):** Source/test
baseline is now the reviewed original Stripe `a38a325f07bdb993b46dc82d85e835d06281aff0`.
Both mandatory original-service CI jobs and the #121 real service
seven-suite PostgreSQL replay through four installed private imports run at
this newer immutable revision. Reviewed changed source HTTP/bearer/RTC pass
and RTC HTTP semantics and three changed real RTC suites; the four imported
verbatim leaves and eight tracked original unit suites are unchanged.
The upstream HTTP `JSON.stringify(req.body)` getter risk remains a
separate service-owned security handoff, not copied into Hub.
**K-3ci / PR #121 merged:** the original
Stripe service's seven unchanged OAuth, money-approval/limit/reservation and RTC
PostgreSQL tests now run a second time **through four private installed core
imports** in the disposable source checkout. The same job still requires
pristine original SQL first; private archive and temporary overlays are
removed afterward. This improves real original-service SQL compatibility
evidence but does **not** commit adoption in Stripe's repository, authenticate
independent human owner money-out consent, certify currently deployed account
isolation or publish a Release. K-3 stays private, unpublished and NOT_READY.
Current Stripe main a38a325 has reviewed tracked changes in source HTTP,
bearer auth, RTC HTTP and RTC passes (four service-owned/security-sensitive
blobs); original four verbatim import leaves and eight inventoried test blobs
are unchanged. Do not silently repin newer service-owned behavior. D-4
direct/relay/Sandbox/revocation acceptance stays independently open.


**Active session outcome:** make K-3's private shared core safe for genuine
service adoption, while pursuing independently authorized D-4 TEST RTC routes.
Five PRs is a planning boundary, not acceptance. PRs #116–#119 added original
Stripe source/SQL/RTC and private artifact evidence and resolved the
no-getter-execution HTTP regression; #120 adds the original-service tarball
import rehearsal without claiming deployment or production adoption.

| Work/owner | Implemented and automated evidence | Deployed/real acceptance | Blocker, dependency, re-entry condition, next action |
|---|---|---|---|
| K-3 portable HTTP / Hub | Real source comparison and private packed consumer; #119 fixes active getter/toJSON regression | No service-owned adapter adoption | Exact original service source body behavior differs. **Re-entry:** exact CI head and service-owned original HTTP review are independently green. **Next:** Stripe service agent evaluates the getter-free transport handoff under its own tests and approval policy. |
| K-3 complete adoption/release / Stripe + Hub | Historical source SQL/owner HTTP and RTC original suites run; #121 adds original SQL rerun through four privately installed imports (requires exact-head CI) | Stripe-owned dependency adoption, current service SQL/account separation, authenticated independent human money consent and immutable Release unverified | Needs original adopting-service tests, owner approval/account isolation proof and reviewed current-source drift. **Re-entry:** verified provider-owned adapter adoption and all gates. **Next:** source-specific CI and K-3 release matrix, no publication before gates. |
| D-4 TEST routes / Hub + service owners | Bounded fleet probe and fake-service runners; IN-06 **already approved** limited TEST relay configuration | Exact service TEST manifest, direct read, encrypted private GitHub relay, Vercel Sandbox and same-pass revocation not jointly proven | Eligible when service-owned exact deployed commit/TEST identity, protected ingress, owner-authorized temporary TEST pass and correct immutable relay binding are verified. **Next:** recheck approved fleet origins and verify four independent real route gates; no new IN-06 request. |
| H-1 central Hub / Hub | No central server yet; D-2 direct client built | Central registry/discovery/routing not present | Work index requires K-3 completion first. **Re-entry:** K-3 release/adoption gates satisfy dependency. **Next:** write the H-1 JIT card, then approved minimum foundation; no silent dependency bypass. |


- **K-3cg / #119 merged:** close demonstrated portable HTTP structured-body mismatch from #116 by importing the source-reviewed, adapted HTTP module from reviewed Stripe source `4fedb344c732b806dae033f87e936350a1180b77` (`src/core/http.js` blob `cc4be02...`) into the private core, including the original service's 16 KiB pre-parsed payload check and explicit raw framing helper. Pin the per-module immutable source revision and adapted core blob in the K-3 trace rather than misrepresenting historical global extraction revision. Update genuine old-source HTTP comparison and isolated packed original HTTP consumer tests. The *host* must still enforce actual pre-parse wire length, and the upstream RTC pass modules and other adapted source have NOT been adopted or security-reviewed for current-source parity. K-3 stays private/NOT_READY, D-4 remains IN_PROGRESS.


- **K-3cf / D-4 original RTC suites (#118, as-if-merged):** pinned original Stripe source at de56af8 now runs two genuine RTC pass/revocation/shared-rate Postgres suites and two original service RTC HTTPS/owner pass unit suites, in addition to all ten previously required original source SQL/owner HTTP suites. Each new test file has a separately enforced immutable Git blob; no fake reference substitute. These are *source-only* disposable tests, not hosted TEST connectivity, full conformance, real owner-pass revocation, service adoption or publication. K-3 private/NOT_READY, D-4 IN_PROGRESS.


- **K-3ce / pending PR #117:** the original immutable Stripe CI checkout now runs an independently packaged, **private offline tarball** through an isolated consumer, comparing four actual source leaf modules (OAuth, encryption, registry, write declarations) with the installed archive. Cross-decryption proves old ciphertext interoperates; source HTTP incompatibility remains explicitly tracked in #116. This is an authentic source+artifact **local rehearsal** but not a service-owned adapter, actual Stripe adoption, SQL/authenticated owner approval or publication. K-3 remains NOT_READY; D-4 hosted acceptance remains open.


- **K-3cd / pending PR #116:** added a bounded, executable CI comparison importing the authentic immutable Stripe service HTTP module beside the private core's extracted HTTP module. The original OAuth owner HTTP and SQL suites remain required. Safe issuer, response, method and body behavior must agree; an oversized pre-parsed-body incompatibility and the missing host raw-wire validator are deliberately reported, not hidden. Current Stripe main was independently inspected at `57703a29e98c776015c751b6b3d8130fa831fd58`: `src/core/http.js`, `rtc-passes.js` and `rtc-http.js` have changed from the CI's reviewed immutable `de56af8` snapshot (all eight pinned unit suite blobs unchanged). **Do not repin those changed auth/RTC modules without completing source and security review.** No actual service adoption, owner money approval, D-4 authenticated route, source-current parity or public release is certified.


- **K-3cc / #115 (as-if-merged):** adapted guarded writes now fail closed with sanitized responses when a source-owned preflight read, ownership guard, preview builder, summary or retry-key callback throws; regression ensures zero provider actions and no leaked exception text. Tracked the new exact portable core blob and regression in K3-SOURCE-TRACE. Original Stripe source SQL and owner HTTP remain immutable CI gates. K-3 IN_PROGRESS/private/NOT_READY until authentic service-owned owner-approval/SQL adoption; D-4 IN_PROGRESS awaiting genuine TEST direct/relay/Sandbox and revocation proofs. Hosting policy remains the documented checked daily main→live workflow and no previews.\n\n- **D-4k / #114 (as-if-merged):** CLI credentials and RTC fleet inventory now reject distinct dash/underscore aliases that would share the same pass environment-variable slot. A fleet with this ambiguity blocks both endpoints before network or authenticated TEST reads; unrelated servers remain independently probeable. Adversarial tests cover saved settings, environment overrides, inventory and runtime. No real D-4 route or revocation is certified; K-3 stays private/NOT_READY.\n\n- **D-4j / #113 (as-if-merged):** real-agent verification now requires service-reported TEST mode plus read_only identity before any tool metadata/read call, preventing non-production owner consent from being applied to live read-only accounts. Tests deny live/production/preview/sandbox/missing modes with no tool execution. This does not exercise real hosted TEST passes, relay, Sandbox or revocation. D-4 IN_PROGRESS; K-3 private/unpublished/NOT_READY.\n\n- **D-4i / #112 (as-if-merged, hosting handoff):** RTC public fleet probes now collect manifest identities before any optional authenticated TEST read, deny duplicate alias origins or conflicting prefixes across different servers, and keep real relay/Sandbox/revocation unverified. Adversarial regression prevents falsely claiming direct authenticated reads on ambiguous identities. Integrated verified October 12 hosting-cost policy into AGENTS and docs/HOSTING-COST-POLICY.md; main requires ci + release-policy at exact head, scheduled checked main→live remains the sole production promotion, automatic previews disabled, existing Basic/queued Vercel and 0.25 CU/300s Neon limits preserved. This documents saved settings, not deployed runtime acceptance. K-3 stays private and NOT_READY; D-4 remains IN_PROGRESS.\n\n- **K-3cb (#110, as-if-merged):** adapted portable dispatcher now binds its explicitly registered own handler before an async policy gate; later registry mutations cannot execute a substituted provider handler under approval for the old declaration. Detail-exemption callback is preflighted as Boolean before provider work, so an exception cannot follow a consequential side effect. Regression proves handler swap, unsafe accessor, metadata change, late policy mutation and non-Boolean refusal. K-3 still IN_PROGRESS/private/unpublished/NOT_READY; D-4 remains IN_PROGRESS with actual owner test routes, revocation and RTC adoption unverified. Next: continue authentic K-3 source/owner proof and real D-4 checks.


- **D-4h (#109, as-if-merged):** added TEST-only owner-opt-in revoked-pass verifier using exact custom RTC `GET /api/whoami`, demanding genuine JSON HTTP 401 `pass_revoked`. Generic 401, 403, 200, network failures and HTML SSO cannot masquerade as revocation; reports are neutral and never print a pass. Offline fake tests are green only when CI passes; **no real owner pass or revocation was used**. D-4 remains IN_PROGRESS until actual identity, three routes and revocation; K-3 private NOT_READY.


- **K-3ca (#108, as-if-merged):** portable MCP dispatch now binds inert frozen catalog declarations before async authorization and denies accessor-based handler/name metadata, coerced tool IDs and oversized provider/formatted error envelopes. New adversarial tests prevent mutated permissions, executable handler properties and error data amplification. This is only the independent portable core: Stripe service still owns real RTC deployment, SQL, owner-money consent and source test adoption. K-3 IN_PROGRESS/private/NOT_READY, D-4 IN_PROGRESS. Next: K-3 source compatibility and D-4 owner-authorized connection acceptance.


- **D-4g (#107, as-if-merged):** pinned public-domain RTC fleet inventory with tracked null (unconfigured) states and real start-of-session HTTP evidence; normal probe no longer requires agents to guess or independently supply deployed hostnames. Stripe public contract returned RTC 1; GitHub reachable advertised RTC 0; Google Workspace 404; Vercel and Neon remain unverified without owner-verified deploy URLs. No read_only pass, relay/Sandbox/revocation run was performed, and all D-4 acceptance stays open. Next: independent protected read_only/route acceptance and K-3 service parity.


- **D-4f (#106, as-if-merged):** mandatory start/end deployed RTC fleet checks for Stripe, GitHub, Vercel, Neon, Google Workspace and added custom servers; executable public manifest probe and opt-in test-only direct read_only check with secret-free output. Missing deployed origins, RTC:0, 404, protected ingress, full D-4 route/revocation all remain distinct. This is not a connectivity acceptance or K-3 publication. Continue genuine protected owner-authorized tests and K-3 release dependencies.


- **K-3bz (#105, proposed):** read-only complete Stripe source tree inspection at `de56af8199fee39b20c2a1ac733562f2622dfda7` confirms unchanged eleven extraction source and eight original suite blobs; four additional service-owned core modules (browser CORS, RTC TEST pass issuer, RTC HTTPS dispatch and route) are now tracked with exact immutable SHA evidence. Drift probe will flag new or altered upstream core modules. Both original Stripe SQL and owner HTTP CI remain mandatory, re-pinned to this reviewed immutable source. Stripe now implements `/api/contract` and `/api/tools/...` RTC TEST read-only endpoints; **deployment, signed ingress, authenticated hub direct/GitHub relay/Vercel Sandbox routes and pass revocations remain unverified**. K-3 IN_PROGRESS/private/unpublished/NOT_READY. D-4 IN_PROGRESS, not accepted. Others' custom RTC adoption remains service-owned. **Next:** complete real owner-authorized D-4 tests, service adoption, K-3 parity/release gates.

- **D-4e (PR #104, as-if-merged):** signed synthetic `edited` issue_comment probes now receive 202 ignored (and invalid signatures 401) before Relay runtime, DB, GitHub or destination initialization. Real `created` events still require fully configured runtime and all existing actor/replay/service guards; tests prove no RTC or provider call during inert ingress checks, and reject malformed/unsigned events. This enables isolated proof of protected webhook reachability **without pretending RTC routing is active**. D-4 remains IN_PROGRESS until actual hosted ingress test, custom service RTC adoption, three route proofs and revocation; K-3 remains private/unpublished/NOT_READY. **Next:** safely verify real webhook reachability and service RTC adoption.

- **D-4d (PR #103, as-if-merged):** hosted relay origins now reject private/loopback/metadata IPv4 and all IPv6 literals, internal DNS suffixes, nonstandard ports, embedded credentials, query/path/fragment and HTTP; explicit localhost fake-service testing remains allowed only in test mode. Runtime issue bindings require exactly actorId and server and refuse duplicate actor/server assignments to multiple issues. Adversarial tests check no forbidden forwarder fetch and correctly scoped valid binds. This is offline proof only; actual RTC service origin and all three external D-4 routes are still not configured/certified. D-4 IN_PROGRESS; K-3 unpublished NOT_READY. **Next:** signed webhook/live read-only RTC service acceptance and revocation.

- **D-4c (PR #102, as-if-merged):** added opt-in, secret-suppressed genuine GitHub-style HMAC webhook ingress probe sending only synthetic `edited` issue_comment events to an exact pinned HTTPS Vercel route. It proves valid signatures receive 202 ignored and invalid signatures receive 401 before any RTC dispatch; fake tests cover SSO HTML, wrong route, malformed replies and excessive query permissions. Execution against the hosted signed ingress remains **unverified** until protected environment and synchronized webhook signing secret are configured. Owner IN-06 authorizes limited read-only test steps, not broad protection bypass or production MCP. D-4 IN_PROGRESS/unaccepted; K-3 private IN_PROGRESS/NOT_READY. **Next:** deploy signed endpoint safely, service-owned RTC adoption and three genuine routes, then credential revocation.

- **D-4b (PR #101, as-if-merged):** Owner IN-06 approved 2026-10-12 for narrowly scoped webhook/ingress, test-only relay identity and genuine read_only custom RTC integration. Added an explicit synthetic GitHub relay comment create/delete probe that checks private bound issue permissions and fails safely; no service pass, provider mutation or secret print. This is executable **offline/unit validation** until an authorized protected-runtime run proves the existing token actually works. The command cannot independently prove the absence of broader token permissions. D-4 **IN_PROGRESS**, not accepted; signed ingress, least privilege proof, immutable RTC server origins, actual three-route tests and revocations remain. K-3 IN_PROGRESS/private/unpublished/NOT_READY. **Next:** owner-authorized scoped webhook/ingress activation and genuine custom service RTC adoption.


- **K-3by (PR #100, as-if-merged):** portable one-time secrets now snapshot the configured 32-byte encryption key at construction, so later caller Buffer mutation does not change encryption/decryption for the existing instance. Consumed SQL rows carrying canonical `expiresAt` or PostgreSQL `expires_at` must contain a valid future Date, with matching aliases if both present. Adversarial tests cover key mutation, SQL erroneously yielding expired rows, malformed/contradictory expiry, proxy Date and shadowed getters; legacy expiry-less rows still depend on mandatory service-atomic SQL expiry checks. K-3 private NOT_READY, D-4 WAITING_ON_OWNER; no real custom RTC adoption or money-owner acceptance claimed. **Next:** authentic service integration and release prerequisites.

- **K-3bx (PR #99, as-if-merged):** guarded writes now deep-snapshot an inert service-projected connection and freeze the audit context before any async read, owner money preflight or provider apply. Tests verify mutation of original owner, tenant, mode or connection ID cannot switch financial authorization or audit attribution; malicious nested/accessor identity and invalid IDs refuse before hooks. Explicit independent owner approval remains mandatory. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** remaining one-time-secret and source adapter safety, custom RTC service acceptance.

- **K-3bw (PR #98, as-if-merged):** the portable MCP dispatcher now rejects active/cyclic service split payloads before inspecting metadata, deep-snapshots/fixes the split result before the page adapter and snapshots the returned page before creating the response. Adversarial tests verify no getter evaluation, tenant-scoped DB persistence, immutable nested result bytes and late page mutation resistance. Source server still owns SQL and authentic RTC integration; core private NOT_READY, D-4 WAITING_ON_OWNER. **Next:** authentic source compatibility and further secure service adapter boundaries.

- **K-3bv (PR #97, as-if-merged):** portable OAuth registration/token requests now inspect inert own framing descriptors and refuse duplicate, case-mismatched, inconsistent rawHeaders, content-length/transfer-encoding conflicts, content type/body getter execution, invalid byte declarations and oversized evidence before touching SQL. Tests preserve normal parsed and raw requests, distinguish semantic size from true wire length and prove no SQL on invalid framing. Authentic framework wire capture and owner RTC server adoption remain separate requirements. K-3 private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** further source integration and service-owned acceptance.

- **K-3bu (PR #96, as-if-merged):** exact reviewed hashes for all eight original Stripe suites are asserted, with both changed OAuth/key suites verified by `git hash-object` in each immutable Stripe SQL and owner HTTP CI checkout. Source-CI checks and negative tamper regressions refuse mismatched 40-hex hashes, substituted CI assertions and missing verification. Original SQL and owner HTTP remain mandatory. This addresses review #92 P2 after exact-head evidence, not release authorization. K-3 private/NOT_READY, D-4 WAITING_ON_OWNER. **Next:** authentic Stripe adapter parity and custom RTC adoption.

- **K-3bt (PR #95, as-if-merged):** portable OAuth now validates and freezes recursively inert JSON request bodies at the framework-preparsed boundary and enforces a 16 KiB semantic payload cap before any service SQL. It refuses nested getters, executable serializers, cycles, Date/custom prototypes, oversized Unicode data and malicious late caller changes while preserving normal POST/PKCE/Unicode clients. Actual raw HTTP wire byte integrity, SQL adoption, independent authenticated owner money consent and custom RTC routes remain service-owned. All original current Stripe SQL/owner HTTP gates required. K-3 IN_PROGRESS/private/unpublished/NOT_READY, D-4 WAITING_ON_OWNER. **Next:** authentic source service RTC adoption/owner acceptance and final K-3 release gates, no premature Release.

- **K-3bs (PR #94, as-if-merged):** portable OAuth now applies source-reviewed public browser CORS/OPTIONS handling at registration, token, authorization-server metadata and resource metadata, before any SQL access; the reused helper supports MCP headers without enabling cookies. Browser-origin getters are denied and private service owner authorization routes deliberately remain separate. Regression verifies 204 no SQL, regular POST, 405 without Origin and no ambient credential header. Current authenticated custom service RTC route and browser acceptance remain service-owned and unverified, as do money-owner approval and release. K-3 private/IN_PROGRESS/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** bounded inert pre-parsed OAuth body acceptance and source service integration matrix.

- **K-3br (PR #93, as-if-merged):** bearer and confidential OAuth Basic authentication now share a single inert Node Authorization proof across normalized, headersDistinct and rawHeaders. Competing mixed-case, duplicate, accessor-backed and contradictory headers are rejected before durable credential lookup or code consumption; valid single Basic/bearer evidence remains supported. New adversarial tests verify both transports. Current original Stripe SQL and owner HTTP CI pin 7c9e981; service integration, independent authenticated human money approval, custom RTC adoption and release remain unverified. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** source MCP/OAuth browser CORS and service-owned host preflight compatibility.

- **K-3bq (PR #92, as-if-merged):** verified current Stripe 7c9e981b75806e7fbfdbfdc84622ed11ca2185a2 using complete GitHub tree (19 tracked original blobs, five changed, fourteen unchanged). Both mandatory real Stripe SQL and owner HTTP CI suites are re-pinned to this exact source SHA, preserving original test assertions and the independently pinned 21 older portable bodies; new test locks the three original runtime and two original suite changes. This establishes updated original-source test evidence, not complete portable service integration, deployed human money-out approval, custom RTC routes or release. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** reconcile new source HTTP/OAuth/CORS behavior and finish owner-dependent release prerequisites.

- **K-3bp (PR #91, as-if-merged):** added a portable OAuth wire-byte preflight matched to current Stripe 16 KiB transport rules, with adversarial length/rawBody coverage. Preserved byte-identical earlier HTTP helper and its mandatory original assertion ledger; marks current source HTTP/adapter migration as incomplete, not incorrectly declaring the newest source fully reconciled. Corrected stale #86 session accounting. Custom RTC adoption, authentic HTTP preflight wiring in service owners, independent money-out approval and release gates remain open. **Next:** current-source OAuth/body/CORS original-assertion reconciliation. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER.

- **K-3bo (PR #90, as-if-merged):** portable OAuth now supports explicitly registered Basic and public PKCE-only clients with durable SQL method/hash binding, canonical Basic authentication and strict registration metadata validation. Retains legacy POST default intentionally; latest Stripe service defaults differently and needs independent adoption acceptance. Original Stripe SQL and owner HTTP CI stay immutable and mandatory. Current source HTTP body caps/CORS, updated source assertion parity, real authenticated owner TEST smoke and RTC interface adoption remain open. K-3 private/IN_PROGRESS/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** reconcile current Stripe source compatibility and K-3 release prerequisites before any publication.


- **K-3bn (PR #89, as-if-merged):** portable MCP dispatch now validates and freezes the service-projected connection snapshot before await; authorization, handler context, nested reads, redaction mode and oversized durable result scope cannot drift to another tenant under async mutation. Adversarial tests reject active connection getters and mutable policy attempts. This is not authenticated source-service or real SQL adoption. K-3 private/IN_PROGRESS/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** reconcile current source Stripe HTTP/OAuth changes with original assertions and release gates, without replacing RTC endpoints with native MCP routes.


- **K-3bm (PR #88, as-if-merged):** portable guarded writes copy and recursively freeze the validated request before asynchronous reads, preview/target guards, money authorization or provider hooks. Synthetic adversarial tests prove caller mutation cannot substitute a larger amount, different target, changed confirmation or dry-run decision. No independent human approval or source-service adoption is claimed. Stripe current-source HTTP/OAuth drift still needs review. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** stabilize connection identity and durable result scope across dispatch authorization boundaries.


- **K-3bl (PR #87, as-if-merged):** portable guarded MCP dispatch now snapshots validated JSON input before asynchronous policy and handler boundaries, so late caller mutations cannot change confirm/dryRun, provider args or detail selection. Regressions cover those boundaries. The stale D-4 unprovisioned references flagged in #86 late P2 review are corrected. A new Stripe main comparison finds actual changes under source HTTP, MCP dispatch and OAuth handlers since reviewed 0e4ae2c; this source drift needs reconciliation, not a premature new pin. K-3 private/IN_PROGRESS/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** reconcile new original Stripe source changes and continue source-equivalent adapter hardening.


- **D-4 infrastructure acceptance checkpoint (docs-only PR #86, as-if-merged):** owner approved lowest reasonable cost on existing Vercel Pro/Neon Launch plans; private `Robinson-AI-Systems/robinsons-toolkit-relay` repository verified; separate Neon project created at capped 0.25 CU with 5-minute idle suspend, replay table/index verified; Vercel `robinsons-toolkit-relay` linked to this hub source and production build READY at reviewed `702d61cf`. Seven Vercel production env names exist (five sensitive, two public), including an owner-entered scoped GitHub token; token **permissions not yet proven**. No webhook, `RELAY_SERVERS`, `RELAY_BINDINGS`, real agent authorization, RTC-adopted custom server, cleanup or three-route certification exists. Vercel deployment protection is still enabled; signature ingress not proven. Custom Stripe and Workspace each expose MCP, not verified RTC routes. IN-02 fulfilled, IN-03 repo created/private, IN-04 partially fulfilled; D-4 **WAITING_ON_OWNER**. **K-3 remains IN_PROGRESS/private/NOT_READY; no shared core release/service repository change.** Batch accounting (retired after #90): PR #86 was already counted in the completed #86–#90 session; **#91–#95 are five NEW PR slots**, with no carried credit. Next work: resume approved K-3 while D-4 relay/service gates remain explicit.

- **K-3bk (PR #85, as-if-merged):** portable OAuth token flow now validates exact own-data client id, hashed secret and redirect entries returned by service-owned SQL before code consumption, and deeply snapshots consumed authorization-code records before PKCE and downstream claim mapping. No active SQL getters, foreign-client rows or grant-claim mutation may mint credentials. Original pinned Stripe SQL/owner HTTP + custom MCP smoke suites remain mandatory. No real owner TEST-account acceptance, independent authenticated money-out consent, cross-service adoption or published Release; K-3 IN_PROGRESS/private/NOT_READY, D-4 WAITING_ON_OWNER. **Next:** real service-owned adapter integration and owner acceptance in service cards; finish remaining K-3 release prerequisites before publishing.

- **K-3bj (PR #84, as-if-merged):** independently verified live Stripe source 0e4ae2c873713e56de50d97af8e550d698eca0fe with an immutable GitHub tree: all eleven tracked runtime modules and eight original suites unchanged after 14 service-owned commits beyond previous pin f2de5160. Both CI source checkout jobs now pin the newer reviewed SHA; owner HTTP additionally executes the authentic Stripe repository's new custom MCP TEST acceptance smoke *unit suite* against synthetic credentials. Evidence verifier requires the extra suite. This is NOT a real TEST-account smoke, owner browser approval, post-adoption test, live release or service mutation. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** source-owned OAuth client row authorization and actual adoption gates.

- **K-3bi (PR #83, as-if-merged):** portable guarded writes now detach and deeply freeze service ownership decisions and validated money previews before asynchronous summary, preflight and final audit hooks. Source-like TEST writes remain supported; tests prove mutating an adapter-owned preview cannot change approved amount or audited cents. The actual independent human money-out approval, shared account/day cap, SQL and provider idempotency are solely Stripe-owned. K-3 private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** single-use secret storage adapter result stability and final source evidence.

- **K-3bh (PR #82, as-if-merged):** portable OAuth grant and refresh SQL credential bindings now deep-snapshot bounded plain claims, rejecting nested active fields, cycles, unsupported prototypes and mutable object aliasing; ordinary Date timestamp data is copied. Regression covers nested tampering, no SQL on invalid grants and preserved successful legitimate issuance. Authentic service migration, independently authenticated owner approval, source adoption and final Release remain open; K-3 NOT_READY/private, D-4 WAITING_ON_OWNER. **Next:** harden owner decision and guarded-write audit result boundaries.

- **K-3bg (PR #81, as-if-merged):** portable OAuth client registration now rejects arrays with hidden/extra keys or holes, snapshots validated redirect URIs, and separates the service SQL input from the public response so adapter mutation cannot rewrite the registered client response. Authentic Stripe source suites and independently authenticated human money-out consent remain service-owned; core stays private/NOT_READY and D-4 WAITING_ON_OWNER. **Next:** source credential-row nested binding integrity and authentic adoption gates.

- **K-3bf (PR #80, as-if-merged):** guarded writes now refuse malformed/padded/control-character service account identity, executable or inherited target ownership decisions and unsafe/oversized provider retry keys before approval, audit or mutation. Legitimate data-record ownership and existing source-shaped keys remain supported by new tests. Independent human money-out consent, shared account/day limits, durable SQL, app ownership, actual service integration and live activation remain server-owned; K-3 stays private/NOT_READY/IN_PROGRESS and D-4 WAITING_ON_OWNER. **Next:** authentic final Stripe source/service adoption and independent owner approval evidence, K-3 release prerequisites; do not publish incomplete core.

- **K-3be (PR #79, as-if-merged):** portable bearer authentication now inspects own normalized, distinct and raw Authorization data descriptors instead of evaluating bearer getters or array accessors. Malformed, inherited or contradictory credentials are denied before token SQL lookup; genuine Node-style data maps remain supported. Actual Stripe transport, owner approvals, account policy and service migration remain independent. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** reinforce guarded-write account, target-decision and retry-key input integrity.

- **K-3bd (PR #78, as-if-merged):** portable OAuth credential creation now copies only service-owned data descriptors and verifies exact issued access/refresh/client identifiers before durable persistence; refresh receipts must also be inert and identity-matched before emitting credentials. Adversarial tests reject getter, inherited and mismatched SQL mappings. Actual owner login, OAuth SQL rotation, consent and migrations remain service-owned; K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** strengthen bearer credential input provenance against inherited/active normalized headers.

- **K-3bc (PR #77, as-if-merged):** portable encrypted secret consumption now snapshots inert own SQL-row fields, binds an optional returned id to the consumed identifier and checks ciphertext/mode/kind/account before AAD, decryption or adapter execution. Existing Stripe-shaped plain SQL rows and TEST/LIVE ciphertext round trips remain supported. Atomic expiration, owner identity, SQL row ownership and service adoption are still Stripe-owned; K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** harden OAuth access-row issuance claim integrity without altering original source suites.

- **K-3bb (PR #76, as-if-merged):** portable MCP dispatcher now refuses active, cyclic or custom-prototype shaped responses, detail projections and error formatter results before JSON serialization, return or scoped persistence. Adversarial regression tests prove executable adapter values are not run. Source Stripe SQL/HTTP jobs remain required; original suites and service repositories untouched. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** validate atomic one-time encrypted-secret consume-row bindings against original source adapters.

- **K-3ba (PR #75, as-if-merged):** portable encrypted one-time secret issuance now requires a valid service account, supported TEST/LIVE mode, bounded slug kind, a finite ten-minute expiry clock and immutable AAD bindings before any ciphertext row is persisted. Tests cover malicious mode/account values, invalid time, adapter mutation and valid source-compatible consumption. Service-owned atomic SQL, owner login and production permission remain separate gates. **Next:** K-3 authentic adoption/owner HTTP and durable SQL integration evidence, final source drift, and release prerequisites. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER.

- **K-3az (PR #74, as-if-merged):** reconciled authentic Stripe source at immutable `f2de5160` after 13 commits beyond `b2a1432f`; exact GitHub tree check confirms all 11 tracked original runtime blobs and eight original test-suite blobs unchanged. Upstream deltas are service administration, docs and CI only. Both mandatory original SQL and owner HTTP source jobs now check out and assert the newer immutable revision, verified by offline pin-integrity tests. This provides fresh source provenance, not owner deployment/adoption proof; K-3 private/NOT_READY, D-4 WAITING_ON_OWNER. **Next:** harden portable one-time secret storage bindings and remaining authentic adapter proof.

- **K-3ay (PR #73, as-if-merged):** reused one inert JSON-descriptor checker across MCP dispatch arguments, result pagination and guarded writes. Nested getters/cycles/custom prototypes refuse before policy or provider action; money previews and independent authorization decisions must also be inert records. Tests prove no reads, owner approvals, mutations or durable intents from poisoned data. Original Stripe SQL/owner suites unchanged; K-3 private/NOT_READY and D-4 WAITING_ON_OWNER. **Next:** re-pin authentic CI to freshly reviewed unchanged Stripe source.

- **K-3ax (PR #72, as-if-merged):** guarded dispatcher rejects poisoned result-page payloads (getters, custom-prototype nested objects, executable serializers, cycles and non-JSON values) before creating any scoped durable handle. Tests preserve legitimate JSON page persistence and existing metadata protection. Original Stripe dispatch/owner tests and server-owned storage remain untouched; K-3 remains private/NOT_READY and D-4 WAITING_ON_OWNER. **Next:** strengthen guarded write boundary input parity and source adapter adoption.

- **K-3aw (PR #71, as-if-merged):** portable OAuth registration and token entrypoints fail closed on repeated URL-encoded form fields, active/inherited/prototype-control request parameters and accessor redirect URI arrays before touching service SQL. Valid data-record requests remain supported; source HTTP helper stays byte-identical, with new strict handling scoped to adapted OAuth endpoints. Stripe current-main read-only drift comparison found no tracked source/test changes after b2a1432f, but new service admin files remain independently owned. **Next:** authentic service adapter and remaining OAuth/write boundary parity. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER.

- **K-3av (PR #70, as-if-merged):** portable bearer MCP authentication refuses contradictory/duplicate Authorization evidence in Node headersDistinct and rawHeaders, including case variants and throwing accessors, before durable token lookup. Normal single Node header representations preserve source-compatible behavior; tests prove generic 401 and zero token/policy activity for malformed transports. Trace and adapted compatibility updated. **Next:** authentic source service integration/adoption proofs, independent deployed authenticated human owner money-out approval and immutable release prerequisites. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER.

- **K-3au (PR #69, as-if-merged):** one-time encrypted-secret issue refuses ambiguous duplicate query parameter names carrying the newly issued identifier, including percent-encoded aliases, before any encrypted row is persisted. Exact single query selector, independent unrelated query arguments and exact path segment remain supported. Adversarial tests enforce denial without storage; source trace updated. **Next:** reject duplicate/mismatched Authorization header evidence before durable token lookup. K-3 IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER.

- **K-3at (PR #68, as-if-merged):** MCP dispatch now refuses top-level getter/inherited/symbol/prototype-control argument records before running authorization policy or any handler; plain and null-prototype own-data JSON records remain accepted. Adversarial tests verify zero getter execution, zero policy/handler and no persisted side effects. Current source trace updated for stricter adapted boundary; upstream source semantics and independent service ownership unchanged. **Next:** harden exact one-time setup link selector ambiguity; K-3 IN_PROGRESS/private/NOT_READY and D-4 WAITING_ON_OWNER.

- **K-3as (PR #67, as-if-merged):** reconciled fresh Stripe main b2a1432f (+12 commits from e3c5b34); independently compared all 11 original core source blobs (unchanged) and eight tracked suites (registry/profiles catalog-only changes). Pinned current immutable source commit in both required authentic SQL and owner HTTP CI jobs; tests refuse unreviewed source-module drift. Four new G-6 admin catalog entries explain 192→196 tools while write count stays 94. Source tests changed only the catalog expectations; no provider/service adoption or independent authenticated human owner money-out evidence. **Next:** strengthen original service adapter and SQL/HTTP boundary proof. K-3 private, IN_PROGRESS and NOT_READY; D-4 WAITING_ON_OWNER.

- **K-3ar (PR #66, as-if-merged):** consolidated duplicated read-only GitHub evidence JSON handling for upstream drift and remote Release proof, with failure coverage; added five bounded, fixed focused-test commands and code-grounded development-efficiency recipes in AGENTS/SESSION-START/implementation guidance. Mandatory CI jobs unchanged; only slice-level research/test overhead reduced. **Next:** fresh source/test drift reconciliation and authentic service compatibility (K-3as). Core remains private/NOT_READY, K-3 IN_PROGRESS; D-4 WAITING_ON_OWNER.

- **K-3aq (PR #65, as-if-merged):** adds a fail-closed audit to the standard check that ties both required original Stripe SQL and owner HTTP CI suites to the reviewed 11-module/eight-suite immutable upstream baseline, enforces all nine source suites, guards local throwaway SQL and aggregate CI participation, and rejects moving checkouts or credential persistence. Regression tests deliberately mutate the pin, repo, suites, runner, CI and baseline. Real source CI still runs separately; this checker prevents evidence drift, not actual service adoption or package release. K-3 remains IN_PROGRESS/private/NOT_READY; D-4 WAITING_ON_OWNER. **Next:** fresh upstream drift review, original service integration/adoption, authenticated owner approval proof, and all remaining release prerequisites.

- **K-3ap (PR #64, as-if-merged):** one-time encrypted-secret setup links must carry the issued identifier as exactly one complete path segment or query value; incidental prefix, suffix, key-name or duplicate matches now fail before any encrypted row is stored. Preserves existing Stripe query setup and exact-path route shapes; tests cover adversarial paths, stored-row non-mutation and real one-time consumption. Service-specific URL parameter meaning, owner login and production SQL still belong to each service. K-3 IN_PROGRESS/private and D-4 WAITING_ON_OWNER. **Next:** explicit original-source CI evidence pin and completeness checks.

- **K-3ao (PR #63, as-if-merged):** portable bearer auth now converts hostile/throwing HTTP request or authorization-header getters into generic 401 instead of exposing an unhandled exception; no token lookup, claims projection or provider access occurs. CI exercises malicious request/header proxies, verifies no internal error text and preserves ordinary Node header compatibility. This is stricter than the source transport boundary; source service migration and independent owner approval remain gated. K-3 IN_PROGRESS/private, D-4 WAITING_ON_OWNER. **Next:** residual adapter input integrity and current source drift/release gates.

- **K-3an (PR #62, as-if-merged):** added required authentic Stripe source HTTP tests for OAuth owner login, setup CSRF/password, money-out approval and independent above-$500 limit changes. The isolated original suites use synthetic credentials and original service handlers; they do not substitute for a deployed authenticated owner or service adoption. Existing original SQL gate remains independent and mandatory. K-3 IN_PROGRESS/private, D-4 WAITING_ON_OWNER. **Next:** source HTTP/MCP dispatch transport and remaining release gates.

- **K-3am (PR #61, as-if-merged):** the hub CI now executes the authentic reviewed Stripe source's OAuth and money-out SQL suites against a disposable PostgreSQL 17 service. This adds original source-service SQL evidence without copying fixture SQL or touching the Stripe repo, and exact-head `ci` requires the source job. Pinned execution alone is not deployed adoption, authenticated human approval or release eligibility; K-3 remains IN_PROGRESS/private and D-4 WAITING_ON_OWNER. **Next:** reconcile fresh Stripe source drift and prove remaining owner UI/transport, service adoption, and release prerequisites.

- **K-3al (PR #60, as-if-merged):** guarded-write confirmation and dry-run flags now require explicit own Boolean data properties on a plain or null-prototype argument record. Inherited confirmation, custom-prototype escalation and executable getters cannot initiate provider mutations or owner money preflight; tests prove denial before reads/audit/money and preserve ordinary previews/confirmed writes. Independent authenticated owner approval, provider idempotency, SQL target guards and LIVE safety remain service-owned, not inferred from confirmation. This closes five new PRs while K-3 stays IN_PROGRESS/private and D-4 WAITING_ON_OWNER. **Next:** actual source-service SQL and owner consent proof, adoption and complete release prerequisites (NO publication until ready).


- **K-3ak (PR #59, as-if-merged):** one-time encrypted-secret setup routes now must embed the newly issued 32-character identifier and cannot normalize through dot segments, encoded separators, backslashes or double-slash path ambiguity. Existing Stripe setup query routes retain compatibility. Tests verify refusal before encrypted row insertion; AES-GCM, expiry, consumption and source routes remain service-owned. K-3 private/IN_PROGRESS; actual source SQL, independent owner approval and release gates remain open. **Next:** hardened guarded-write confirmation context and outstanding service release prerequisites.


- **K-3aj (PR #58, as-if-merged):** reconciled live Stripe main e3c5b34 with the pinned 19-path K-3 source/test inventory: all 11 core source module blobs unchanged; registry and profile unit-suite blobs changed only catalog counts/tool names following new G-5 features. Reviewed and pinned both updated test suites, preserving the 21 portable original assertion bodies and four source-owned HTTP bodies. Drift checker now differentiates source-file changes, test-suite changes and missing files without treating test-only drift as release permission; CI regression covers each classification. K-3 IN_PROGRESS/private, D-4 WAITING_ON_OWNER. **Next:** actual SQL/service adapter proof and remaining release prerequisites.


- **K-3ai (PR #57, as-if-merged):** bearer gate now refuses non-string/duplicate Authorization headers without invoking the lookup and catches durable-token database outages before any identity reaches dispatch, returning generic HTTP 503 rather than leaking provider SQL errors or falsely labeling credentials revoked. Tests prove no policy call, no tokens in replies and preserved invalid-token 401 for ordinary denials. This intentionally strengthens the portable transport seam; source-service outages and authorization remain service-owned. K-3 IN_PROGRESS/private; D-4 WAITING_ON_OWNER. **Next:** source-owned SQL query parity and OAuth claim compatibility.


- **K-3ah (PR #56, as-if-merged):** internal `runRead` now requires explicit `writes:false` independently of permissive top-level authorization. A full-profile service policy cannot turn a nested read convenience into a money-out or other write; missing write metadata also fails closed. Compatibility tests cover denied and permitted nested behavior. Core remains private, K-3 IN_PROGRESS; original-service adoption and release prerequisites remain open. **Next:** source-authentic bearer/owner service adapter compatibility and release gates.

- **K-3ag (PR #55, as-if-merged):** strengthened service-neutral MCP bearer projection boundary to reject echoed bearer credentials, token/secret-named fields, live getters, inherited/exotic objects, cycles, unsupported values and oversized identities. Explicit server-selected claims are cloned and deeply frozen before dispatch; invalid projection responds with generic 401. Tests prove source-compatible flat identity, immutable nested identity and denied secret leakage. Source trace updated; source service policy and durable SQL remain service-owned. K-3 IN_PROGRESS/private, D-4 WAITING_ON_OWNER. **Next:** remaining authentic source-service adoption and complete release prerequisites; never release partial core.

- **K-3af (PR #54, as-if-merged):** pinned original Stripe OAuth HTTP handlers now run through a disposable multi-pool PostgreSQL service-contract adapter. Tests enforce cross-pool one-use authorization code, concurrent refresh replay denial, unchanged TEST account/profile/listing, revocation, LIVE refusal and shared login lockout. This is authentic original-handler execution but fixture schema, not Stripe service migration or independent owner login. K-3 IN_PROGRESS/private; D-4 WAITING_ON_OWNER. **Next:** harden remaining portable source/adoption boundaries and complete release prerequisites.

- **K-3ae (PR #53, as-if-merged):** read-only final GitHub Release auditor requires independently approved candidate commit/tag/semver/name/size/SHA256, checks actual published release and immutable tag target, then independently streams/downloads the exact archive and compares SHA256/bytes. Offline positive and tamper/draft/moved-tag/error cases pass only in CI; no release exists or is published by this utility. K-3 IN_PROGRESS/private; D-4 WAITING_ON_OWNER. **Next:** real service-adapter release boundary proof and remaining prerequisites.

- **K-3ad (PR #52, as-if-merged):** all four remaining OAuth HTTP source-owned original assertion bodies now execute without body rewrites against the pinned full Stripe HTTP/auth handlers using a minimal disposable login/token test adapter. Unit assertions pin the original decoded Git blob and compare unchanged bodies. This is fixture-only, NOT Stripe service owner UI, SQL, production permission or adoption verification. Original portable tally stays 21; K-3 IN_PROGRESS/private, D-4 WAITING_ON_OWNER. **Next:** enforce proof of service adapter boundaries and final remote artifact verification prerequisites.

- **K-3ac (PR #51, as-if-merged):** live source-drift probe compares all 11 original Stripe source Git blobs and 8 original test suites to reviewed Stripe main 587ad2e, with offline injectable test coverage for changed, missing, truncated, and unreachable evidence. No source-file drift was observed at inspection. This is not final-candidate or service adoption proof; core remains private, K-3 IN_PROGRESS, D-4 WAITING_ON_OWNER. **Next:** authentic service adapter boundaries and remaining original endpoint assertions.

- **K-3ab (PR #50, as-if-merged):** added a CI-enforced, machine-readable K-3 release prerequisite guard and candidate-denial command. Eight named prerequisites remain explicit; seven require more than local private-package proof. Tests reject false completion, fabricated owner approval, missing evidence, provenance drift and public package toggles. This is a protective release block, not a release. K-3 IN_PROGRESS; D-4 WAITING_ON_OWNER. **Next:** actual source/service integration, complete original assertion body parity, final immutable candidate and authenticated GitHub Release proof only when eligible.

- **K-3aa (PR #49, as-if-merged):** pinned original Stripe MCP transport source and executed its unchanged dispatch function with isolated source-policy/result shims beside the portable dispatcher. Asserted guarded tool visibility, nested reads, synthetic TEST write, oversized scoped storage and failures. Portable prototype-handler refusal is deliberately stricter. This is not SDK route, provider redaction, live SQL or owner money approval proof. K-3 remains IN_PROGRESS/private. **Next:** reinforce service integration/release-prerequisite enforcement.

- **K-3z (PR #48, as-if-merged):** pinned the complete original Stripe OAuth HTTP endpoint suite as an encoded, Git-blob-verified source snapshot. Executed its first two portable original endpoint assertion bodies unchanged. Four remaining cases depend on service-owner login, durable account/grant/refresh/lockout or authenticated bearer and remain service-owned; do not count them as portable. Core private/K-3 IN_PROGRESS. **Next:** dispatch source/runtime compatibility and full release/adoption gates.

- **K-3y (PR #47, as-if-merged):** pinned and executed original Stripe guarded write source against portable write lifecycle with synthetic audited preview, confirmation, ownership, LIVE denial, uncertain outcomes, durable audit and independent money preflight. The portable malformed-money refusal intentionally tightens source behavior. No provider requests or real owner approval performed; service owner gates still required. K-3 remains IN_PROGRESS and private. **Next:** dispatch runtime/source integration and original endpoint assertion parity.

- **K-3x (PR #46, as-if-merged):** execute pinned original HTTP utility source side by side with private core for HTTPS issuer parsing, body media/invalid input, escaped output, no-store headers and 405 refusal. Endpoint owner login and SQL still service-owned. K-3 remains IN_PROGRESS/private; no release or service repo changes. **Next:** source endpoint assertion parity and write/dispatch runtime compatibility.

- **K-3w (PR #45, as-if-merged):** pinned original OAuth source handler/runtime and executed source-vs-portable HTTP metadata, registration safety, grant/refresh and replay-denial differential tests with isolated fake service storage. Source owner-account authorization page remains service-owned. This completes the five-PR batch without claiming source UI/SQL, guarded write/dispatch adaptation, or an actual Release. K-3 IN_PROGRESS and private; D-4 WAITING_ON_OWNER. **Next:** remaining original HTTP endpoint assertion-body parity and adapted write/dispatch runtime compatibility; complete source-service SQL and release prerequisites before any public GitHub Release.

- **K-3v (PR #44, as-if-merged):** pin actual source bearer/one-time/HTTP/crypto runtime blobs and execute source modules directly against portable adapters under isolated fake database bindings. HTTP challenge/status/error parity and bidirectional AES-GCM ciphertext compatibility are now tested, with altered AAD refusing. Disposable fixture is not production SQL, owner-login, revocation or external adoption evidence. K-3 remains private/IN_PROGRESS. **Next:** source OAuth endpoint and remaining guarded write/dispatch matrix and release readiness gates.

- **K-3u (PR #43, as-if-merged):** source profile assertion bodies (four) now pinned and verified, bringing executed source-compatible assertion count to 19. A focused profile-to-dispatch denial test proves hidden reads and writes cannot be invoked through a copied profile field or caller confirmation. The adapted source compatibility ledger distinguishes portable evidence from missing source-service behavior. K-3 IN_PROGRESS/private; no release. **Next:** bearer and one-time secret source matrix, remaining source endpoint assertions.

- **K-3t (PR #42, as-if-merged):** exact original-body parity now covers two source crypto cases and five portable write-declaration cases as well as eight OAuth/registry cases. The crypto key fixture uses its single documented scanner-compatible computed-name rewrite; the exact upstream source is retained as an encoded, hash-checked audit snapshot; service-owned provider key storage, real registry catalog and write adapter cases remain in Stripe. K-3 stays private and IN_PROGRESS. **Next:** reconcile upstream HTTP endpoint assertions and adapted-interface compatibility, then release gates.

- **K-3s (PR #41, as-if-merged):** eight actual original Stripe assertion bodies (six OAuth, two registry) are now pinned as source Git blobs and compared to core tests through parsed test function bodies. CI rejects changed bodies even when titles and expect counts are preserved. Source-only service catalog tests remain excluded; other verbatim tests and adapted interfaces still need full parity. Core private; no Release. **Next:** crypto and write declaration original assertion-body parity.

- **K-3r (PR #40, as-if-merged):** adapted MCP dispatch now rejects prototype-inherited handlers and any page adapter attempt to overwrite a core-generated result handle, byte count, record count, retention or summary. New compatibility tests cover scoped redacted oversized results, nested authorization and refused stores. `docs/audits/K3-RELEASE-GATES.md` records the original assertion/adapted-interface and actual GitHub Release verification prerequisites. GitHub Releases was empty when checked. K-3 remains IN_PROGRESS and private; next original source assertion-body parity and complete adapted matrix. D-4 stays WAITING_ON_OWNER.

- **K-3q (PR #39, as-if-merged):** guarded write now refuses missing, fractional, negative and inconsistent provider-derived money preview metadata before independent owner approval, audit or provider mutation. Broken provider error classifiers are recorded as uncertain rather than escaping the audit lifecycle. Synthetic source-style safety regressions cover refusal, valid approval, uncertain outcome and read-back. Core still private; money consent and shared limits remain entirely service-owned. Next: complete compatibility/release prerequisites; K-3 IN_PROGRESS.

- **K-3p (PR #38, as-if-merged):** portable OAuth protocol now refuses a server claim mapper or durable refresh adapter that substitutes an issued access token, refresh token or client ID. Source-style grant and refresh tests verify preserved service-selected claims, replay denial and failed stores; source owner login UI and durable SQL still require service-owned adoption. K-3 IN_PROGRESS; no release or production activation.

- **K-3o (PR #37, as-if-merged):** pinned offline assertion inventory for all five byte-identical core exports, with 21 locally enforced cases across the five verbatim exports and four explicitly server-owned cases. Root check now rejects missing, skipped or reduced local tests; actual assertion-body equivalence, six adapted boundaries and source service adoption still require further proof. Next: adapted OAuth, bearer, write and dispatch compatibility; core remains private and K-3 IN_PROGRESS. D-4 stays WAITING_ON_OWNER.

- **K-3n (PR #35, as-if-merged):** reproducible local offline pack evidence now checks exact tarball file list, SHA1/size and SHA256, with tamper/extra-file negatives; it prints explicit NOT RELEASED/NOT READY status. Two adoption handoffs specify the independent Stripe and Workspace server verification sequence, including separate owner money consent and SQL proof. **Next:** reconcile complete original source assertion parity and amended adapter semantics, authorize and verify an actual GitHub Release only once all gates pass. K-3 stays IN_PROGRESS. D-4 remains WAITING_ON_OWNER.

- **K-3m (PR #34, as-if-merged):** pinned, machine-verified source provenance for all 11 public core modules at Stripe main 60877ae: five byte-identical exports and six explicit service-adapted boundaries. CI now fails on undocumented local source changes or missing export/test mapping and never treats the private package as released. **Next:** complete adoption/release verification and source assertion parity; K-3 remains IN_PROGRESS.

- **K-3l (PR #33, as-if-merged):** disposable PostgreSQL integration proof now exercises cross-pool atomic consume-once encrypted secrets, expired/AAD-mismatched refusal, shared login lockouts and expiry, and connection-scoped oversized result storage. These are fixture adapters using independent pools, not a production migration or source-service adoption; K-3 remains IN_PROGRESS. **Next:** source-specific assertion parity and complete release gating before any publication.

- **K-3k (PR #32, as-if-merged):** release-isolation gate runs in npm check, verifying the core private package exports every shipped ESM module explicitly, rejects source symlinks/path escapes, runtime dependencies, dynamic imports, install scripts and unreviewed new source files. Negative fixtures prove the gate catches violations. The complete package release is still gated by source-parity/adoption checks.

- **K-3j (PR #31, as-if-merged):** private core integration proof joins OAuth registration/grants, bearer projection, read/write dispatch, durable result scoping and server-owned independent money preflight. The deterministic fake verifies refresh/revocation, read-only refusal, audited money approval and oversized scoped storage; no provider or service repository touched. **Next:** reconcile complete Stripe upstream assertion coverage and remaining source compatibility boundaries before any release. K-3 remains IN_PROGRESS.

- **K-3i (PR #30, as-if-merged):** private core gains transport-free MCP dispatch with mandatory per-service tool policy, result redaction, field projection and scoped persistence adapters. Tests cover denied and indirect calls, compact results, oversized secure handles and failures; packed consumer imports without provider SDK. **Next:** K-3 final source-compatibility/adoption evidence and actual GitHub Release asset (only after every gate); K-3 stays IN_PROGRESS. D-4 still WAITING_ON_OWNER.

- **K-3h (PR #29, as-if-merged):** source-equivalent fail-closed write lifecycle now in private core with mandatory service account adapter and provider retry-key prefix. Independent money preflight/approval remains server-owned; audit intent precedes all provider mutations; uncertain outcomes are never called success. Tests cover previews, guards, money refusals, idempotency and audit failures. **Next:** K-3i MCP dispatcher/transport boundary; release/adoption still gated.

- **K-3g (PR #28, as-if-merged):** portable private OAuth metadata, client registration and token grant/refresh HTTP handlers extracted with explicit server grant-claim projection and durable token storage. Account authorization UI, owner-login locks, selected-mode permissions and source DB remain service owned. **Next:** K-3h guarded write lifecycle; K-3 not released/adopted.

- **K-3f (PR #27, as-if-merged):** one-time encrypted secrets have a portable private adapter with explicit source AAD, route, account row and atomic durable store contracts. Ten-minute expiry, 32-character IDs and authenticated decryption retain Stripe source semantics; adapters cannot change old ciphertext without a server-side migration. Source server unchanged. **Next:** K-3g OAuth handler seams; no Release/adoption.

- **K-3e (PR #26, as-if-merged):** private core adds service-neutral MCP bearer authentication. The server must inject token lookup and an explicit fail-closed connection projector; the source Stripe module remains untouched, with all account/mode/profile/expiry/revocation decisions at the server. Offline packed consumer and denial-path tests cover the new subpath. **Next:** K-3f OAuth handler boundary reconciliation; K-3 remains IN_PROGRESS, no release or server adoption.

- **K-3d (PR #25, as-if-merged):** packed the **private** shared core
  and installed it in a temporary offline consumer separate from all hub
  workspaces. Its six public subpath exports import without provider modules,
  credentials or configuration; Stripe-specific handlers remain unexported.
  This is release-readiness evidence, **not** the K-3 final Release tarball.
- **Next eligible work:** K-3e, reconcile and extract remaining service-neutral
  OAuth/MCP/write lifecycle boundaries through explicit adapters, with source
  behavior and service guards intact. K-3 stays IN_PROGRESS; no release or
  adoption until all source tests, clean consumer and actual Release artifact.


- **K-3c (PR #24, as-if-merged):** source-equivalent profile visibility,
  public tool metadata and Stripe's explicit write-declaration checker copied
  into private core with original profile assertion bodies plus money metadata
  rejection tests. This is **metadata-only**; it does not implement money-out
  execution, server-side guards, or authorize the hub to override a server.
  Next K-3d: package isolation/consumer smoke and finish boundary accounting.


- **K-3b (PR #23, as-if-merged):** extracted Stripe's source-identical
  registry and HTTP helpers into private `packages/core`. Dedicated tests
  check duplicate/missing handlers, HTTPS issuer, response headers, safe input
  parsing and 405. K-3 remains IN_PROGRESS, no tarball released.
  Next K-3c: metadata/write declaration portability and policy separation.


- **K-3a portable security core (PR #22, as-if-merged):** `packages/core` now has
  source-identical Stripe OAuth primitives and AES-GCM secret encryption, with
  upstream assertion bodies and a small injected login-store fixture. This is a
  **partial, private** package: no release, no server adoption, no live test passes.
  K-3b next: registry/HTTP/metadata helpers; keep the whole-folder boundary gated.
  Stripe A–C cards remain MERGED at inspected main `09ed53a048820989a3f69c057ebf8a6be0c2a988`.


- **D-4a merged (#20):** agent recipes and secret-safe read-only route verifier;
  actual fake direct and signed encrypted relay tests. No real agent route is certified.
- **Next executable card:** K-3 shared-core extraction, after verifying current
  Stripe MCP A–C completion and actual helpers against its repository docs.
  Write K-3 just in time; do not modify Stripe from this repo or invent compatibility.
- **D-4 WAITING_ON_OWNER:** real local direct, GitHub-only relay and Vercel Sandbox direct runs; owner-approved short-lived passes and subsequent revocation evidence. IN-02/03 infrastructure and private repo are created; IN-04 is partial. Signed GitHub webhook, scoped agent issues/bindings, authenticated ingress, valid RTC-speaking custom server and real read-only tests remain absent. Actual OS vault smoke also unverified.
- D-3 code complete (#17–19), with owner-approved Vercel build READY and Neon migration provisioned (#86 docs checkpoint); relay **not functionally connected**.
- This chat stopped at #20; normal sessions merge five new substantial PRs and
  return the concise repo-documentation-based continuation prompt (AGENTS).

## Implementation guidance

Code-grounded recipes now live in
[IMPLEMENTATION-GUIDE](implementation-contracts/IMPLEMENTATION-GUIDE.md), linked from
startup and card writing. §6 records Stripe A–C completion at the inspected SHA,
but also the failed whole-core portability assumption. K-3 remains next/JIT and
needs fresh source reconciliation and amendment before semantic extraction.
No product code, owner gates or card completion status changed.

## Environment

- Repo `Robinson-AI-Systems/robinsons-toolkit-hub` (created by Chris 2026-10-10; public, no automated review). First commit straight to `main` because the
  repository was empty; every later change goes through an `ai/*` branch and a PR.
- Private relay transport repository, protected READY Vercel build and capped separate Neon replay database are provisioned (IN-02 fulfilled; IN-03 repo fulfilled; IN-04 partial). GitHub webhook, source RTC adoption, relay mappings, token permission verification, owner authorization and real route passes remain unverified (D-4 WAITING_ON_OWNER).
- Old toolkit `Robinson-AI-Systems/robinsons-toolkit-mcp`: reference only (no compatibility; Batch M dropped 2026-10-10).

## Recent merges (newest first)

**2026-10-11 — D-4a agent setup (#20):** all environment recipes and read-only
runner, with named environment passes/args and neutral output. Real routes remain
D-4 WAITING. Next K-3 after fresh prerequisite verification.

**2026-10-11 — D-3 relay completion (#19):** safe direct-first CLI/MCP/SDK routing,
exact RTC path allowlist, independently authenticated ciphertext cleanup and inert
hourly scheduler; fake end-to-end tests. No live deployment authorization assumed.

**2026-10-11 — D-3b server (#18):** raw signed webhook private-repo bindings,
atomic Postgres replay claims and encrypted guarded replies. CI database proof
uses independent pools; no production passes/secrets used.


**2026-10-11 — D-3a encrypted relay client (#17):** random request IDs, ephemeral
X25519 exchange, authenticated ciphertext, symmetric encrypted reply key delivered
only inside sealed payload; GitHub receives envelopes rather than secrets, and both
comments are deleted after a successful encrypted reply. No real GitHub token used.


**2026-10-11 — D-2 local MCP (#16):** newline-delimited JSON-RPC 2.0 stdio
server, deterministic tool listing, two-server calls with real RTC HTTP passes,
provider guard refusals, and compact schema budget test. No direct production
accounts accessed.


**2026-10-11 — D-1 compiler and CLI v1 release (#15):** TypeScript 5.9.3 pinned;
actual generated SDK declarations typechecked with strict compiler and deliberate
expected type errors; test:doors/test:types scripts are real; cli-v1 main-only tag
workflow added. Next D-2.


**2026-10-11 — D-1c secure OS credential manager (#14):** Linux Secret Service,
macOS Keychain and Windows Credential Manager native adapters with no secret argv
or plaintext secret files. Real hardware keychain smoke tests remain to be performed.


**2026-10-11 — D-1b SDK and agent setup (#13):** generated typed SDK from real RTC tool
metadata; zero persisted passes; real SDK read and guarded write tests; controlled AGENTS.md
block edits, idempotency and symlink refusal. Next D-1 handles credential management.


**2026-10-11 — D-1a direct rtool commands (PR #12):** standalone direct tool access
from any Node 24 command-line workspace, without a hub. Configured passes never enter
URLs/config files; results have safe summaries and explicit private output files.
D-1 remains open for login, SDK, setup and skill tools.


**2026-10-11 — K-2b authentication conformance (PR #11):** a local OAuth fixture checks
profile/listing/areas/mode/account across refresh; its deliberate bug is detected.
Real overlapping requests across two processes prove shared Postgres limits.


**2026-10-11 — K-2 conformance and reference fake (PR #10):** actual localhost HTTP fake,
secure pass-shape generation, read and guarded-write calls, fake-change log, handle isolation, deterministic
named probes, seven deliberate regression faults, skipped-role reporting and CLI arguments from env variables.
Script `npm run test:conformance` now executes real tests. This entry is written as merged per Step 6.


**2026-10-11 — K-1 contract freeze (PR #9):** reviewed five server plans against RTC 1, mapped normative
rules to named checks or server-owned tests, clarified the runner's environment-only role passes and
honest skip handling. A secret-shape scanner rule detects real-looking RTC passes even outside known
assignments. K-2 is the next implementation card. This entry is written as merged per PLAYBOOK Step 6.


**2026-10-10 — CI cadence (docs + CI config PR):** never push while a PR's CI run is in progress (SESSION-START §6,
PLAYBOOK Step 5); obsolete PR runs are cancelled, runs on `main` never are. Next action unchanged.

**2026-10-10 — K-0 repository foundation and proven CI (PR #5):** `package.json` (Node 24.x, npm workspaces
`packages/*`, exact versions, committed lockfile); `npm run check` = secret scan with hub rules (passes, relay keys,
GitHub tokens, every server's service keys), docs check (code needs STATUS + card; CONTRACT needs DECISIONS), index
validation, lint; `npm test` (unit) and `npm run test:db` (throwaway Postgres, isolated schema per file, two-pool
helper); CI jobs `check`, `unit`, `db` and the aggregate `ci`. Red proof: a deliberately failing test turned `unit` and
`ci` red (https://github.com/Robinson-AI-Systems/robinsons-toolkit-hub/actions/runs/38080117719); removed; green at the merged head. Copied from `neon-mcp` @ `d396fb4`. New card K-0 and a K-2b
split (BATCH-K amendment); K-2 card written READY; K-1 card gained two questions (how conformance gets its test passes;
a recognisable pass prefix for secret scans).

**2026-10-10 — Three new servers started (docs PR):** S-github, S-vercel, S-neon done in their own repos; contract §3:
every tool name starts with the server prefix; Node 24.x; server playbook §3b lessons (gap check against old toolkits,
proven A-1 foundation, REST PRs, bounded CI waits, org-wide Codex reviewer).

**2026-10-10 — Review fixes (docs PR #3):** contract §2 now requires that a login refresh keeps its settings and that
rate limits and lockouts are counted in the database; §9 checks both, the rate limit with two server processes and
overlapping calls. RTC 1 stays a draft, clarified in place, until K-1 freezes it. Next action unchanged.

**2026-10-10 — Owners and end users too (docs PR):** contract §3 audience tag and §11 owner/admin conventions; playbook
owner side and coverage matrix; L-4 guided settings runner.

**2026-10-10 — General development tool (docs PR):** contract §10 developer conventions; playbook Batch V; roadmap
purposes made generic; hub workflows lead with dev environment up/down.

**2026-10-10 — Plan written (initial commit):** AGENTS, START-HERE, SESSION-START, PLAYBOOK, drift protocol, CONTRACT
(RTC 1), PLAN, MASTER-ROADMAP, 7 batch designs, server playbook and roadmap, old-toolkit audit, owner inputs,
decisions, work index with validator, first card K-1.

## Blocked

Nothing. Owner inputs open: IN-02 … IN-05 (`OWNER-INPUTS.md`).
