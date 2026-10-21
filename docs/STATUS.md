## 2026-10-21 — owner-requested maximum-authority planning (source only)

Inspected main `41f796126f53173004f95d58cc81956f43055d6c` and existing open work before editing. Added
[MAXIMUM-AUTHORITY](designs/MAXIMUM-AUTHORITY.md) and indexed CAP-1..CAP-5 as
APPROVED / NOT IMPLEMENTED. Existing provider acceptance evidence is unchanged;
no new live pass, deployment, paid action, credential, grant or production effect.
This is explicitly requested planning maintenance: zero production lines and zero
completed implementation subsections. Ordinary supported authorization gets every
operation it can perform; God Mode only simplifies genuinely necessary additional
authority. Separate developer/operator/customer contexts explicitly. Existing original
unfinished cards keep ownership; no work is counted twice. Next: existing eligible
acceptance/implementation first, then CAP-1 inventory and its dependency-ordered work.
Exact-head checks/self-review and any existing reviews remain mandatory before merge.

## October 19 — 2026-07-28 native MCP stateless compatibility (source PR; hosted acceptance OPEN)

The published MCP protocol includes a breaking 2026-07-28 stateless Streamable HTTP revision. Hub previously supported only initialize-based 2025-03-26/06-18/11-25 request handling. This branch adds a **dual-era** authenticated `/api/mcp` door: modern per-request `_meta` version+client capabilities with exact HTTP `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name` mirroring, required `server/discover`, `resultType:complete`, deterministic bounded existing `tools/list`, private caching hints and preserved Hub server identity. Existing legacy handshake and Hub-owned H-3 federation remain unchanged. Error handling refuses mismatched/unknown versions and client capability shapes **before** entering provider dispatch. The same authenticated Hub actor and original issuer-scoped service grants remain the only authority.

Source protocol support is NOT proof of a real 2026 desktop or mobile client install. **OPEN**: exact-head unit/real PostgreSQL and CI, checked release, normal live OAuth owner authorization, genuine Hub-initiated Workspace whoami/read/denial/refresh/revocation and independently tested compatible desktop/mobile client. A separate ChatGPT Cloud adapter cannot substitute for real remote MCP. ChatGPT's own current mobile custom MCP installation is not supported in its publicly documented UI; mobile-compatible clients elsewhere may support remote MCP. No provider/user/production changes or spending.

## October 19 — owner universal MCP connectivity, private branding and authority directive (source in PR)

Latest initial baseline: checked Hub main/live/READY deployment `3cc7f4ad4332155d639125b23e8a5c4c13804a3d`, additive OAuth tables installed, no usable LIVE Hub caller family and no stored issuer-OAuth Workspace connection. Hub already exposes independent `POST /api/mcp` Streamable HTTP with real Hub OAuth, distinct from the optional metadata-only ChatGPT cloud alias. Provider RTC1 services remain directly usable. New H-1/H-3/H-4 source patch validates browser Origin **before database access** without blocking Origin-less native/CLI clients, adds the privately attributed Hub display title while preserving stable technical IDs, and corrects demonstrably stale TEST-only product text in owner consent/inspection and some denial messages. Actual authorization, provider guards, narrowing, spend and write approvals have NOT been weakened. The owner explicitly wants user-delegated LIVE/write capability when legitimately issued, not permanent developer TEST-only product defaults.

Full cross-module restriction inventory and residuals: [2026-10-19 native gateway/branding/authority audit](audits/2026-10-19-direct-mcp-branding-authority.md). **Still OPEN:** independently authenticated native desktop/mobile client initialization, provider whoami and harmless read through the deployed Hub, denied out-of-scope access, refresh/revocation, genuine LIVE Workspace caller consent, multi-service production scaling, 2026-07-28 MCP protocol compatibility assessment, full provider writes within original C-1 independent authority (no H-3 bypass), plugin distribution compliance and public multiuser readiness. Real Workspace acceptance is an **early next test**, not delayed for full fleet. CI and source are not hosted/desktop/mobile acceptance. No LIVE Google account was altered, no public plugin published, no prod migration/release executed for this branch.

## October 19 — Hub↔Workspace early-release onboarding correction, SOURCE ONLY

On the checked main `43eed4658527f32c9fca9666b0d31ecf8894b22d`, early Workspace discovery already has a generic RTC1+OAuth implementation but owner OAuth onboarding contains a **first-run bug**: a missing optional caller family is rejected even if exactly one eligible agent connection exists. This branch fixes null/unique Hub family auto-selection, refuses ambiguous/invalid family before any upstream DCR or registry enrollment, and adds owner-only mobile form enumeration of actually eligible Hub OAuth family sessions. Discovery of public RTC metadata is still available when no Hub caller is eligible; the page explicitly says no provider registration/consent happened and provides the setup prerequisite. Full provider permission and issuer consent checks are unchanged.

Real Workspace production `GET /api/contract` returned RTC1, `google-workspace-mcp`, prefix `workspace`, 381 tools, and TEST/LIVE modes; public protected-resource and issuer metadata both returned real provider-owned OAuth authorization/token/client-registration endpoints on deployed `Workspace live=912e4fb330608de1fa45639eb656f3faea9fd733`. These are genuine **public metadata GETs only**, NOT Hub-origin signed requests or a passed owner OAuth connection. No Google credentials, DCR registration, writes or production data modified. Hub live remains `22ae5485621423ad822f77b4a300c7d548d5aea7`, so new Hub OAuth source cannot be exercised live before a separately authorized checked release/migrations 025-027.

The next external milestone is deliberately **early**: deploy checked Hub revision with reviewed database migrations, initiate exact HTTPS Workspace metadata discovery from Hub owner's mobile connection screen, select current Hub caller, complete original Workspace OAuth consent for the chosen account and LIVE read-only profile, verify guarded harmless provider read/denial/refresh/revoke and original standalone continuity. Developer TEST grants never stand in for this. H-2/H-4 original whole acceptance remains OPEN until actual hosted evidence.

## October 19 — source implementation: encrypted OAuth result pages and readiness

PR (current H-3/H-4 continuation, from green merged #237) adds migration `027-hub-oauth-result-handles.sql`, an independently owner/caller/session/connection-bound encrypted OAuth result store and an extension of the **same fixed** `hub_result_read` tool to securely page 8–64 KiB OAuth provider READ responses without retrying a provider POST. Original RTC1 pass-backed handle storage/read is untouched; missing optional OAuth tables do not block legacy pages. Rechecks: exact currently active caller, provider connection, mode/profile/areas, provider token expiry, local revocation and immutable scoped grant fingerprint. Refused or tampered pages return nothing. Expiry cleanup is bounded to 100 rows. The private owner readiness page and dashboard report optional OAuth metadata only (test/live connection counts, refresh availability, expiry and reconnect needs) and do not read stored tokens or probe providers.

**Source does not mean LIVE acceptance.** Provider-independent RTC1 compatibility spec now includes a server-maintainer adoption checklist and provider-owned account/permission/refresh/continuation requirements; do not make every service contact Hub or add a custom Hub adapter. Green CI and the original H-2/H-3/H-4 hosted acceptance remain independent; current Workspace sign-in/harmless read/denial/refresh/revocation is the earliest outstanding external continuity gate after authorized release. No production release, account write, customer data modification or spending occurred.

## October 19 — OAuth Workspace interoperability corrections (source only; real acceptance OPEN)

Workspace code inspection confirms actual protected MCP meta-tools `workspace_search_tools`, `workspace_describe_tool`, `workspace_call` and `workspace_whoami`. Its compact search uses `nextOffset`/`offset`, not the opaque cursor used by some other RTC1 servers. The Hub OAuth adapter now preserves offset, page and opaque continuations through the original signed broker without provider-specific routing. Real Workspace OAuth `whoami` attests matching Google account identity, not the RTC pass's mode/profile/area snapshot. Hub accepts that narrower attestation only for nonwriting READ permissions, retains the original Hub owner-selected scope, encrypts the principal identity and **refuses an account switch during token refresh**. Full/write delegated profiles without a complete policy attestation still fail closed. Synthetic tests cover real provider-shaped offset and identity data, malformed provider continuations, refresh refusal and real disposable PostgreSQL isolation; source gates must remain green at the exact PR head.

These fixes do not constitute a LIVE Workspace connection, deployed revision, owner OAuth consent, issuer refresh or provider writes. The early real Workspace continuity checkpoint is still separately OPEN: after authorized Hub deployment and migration, perform a normal Hub-initiated Workspace OAuth sign-in, inspect actual scoped connection, execute a harmless Workspace read through the Hub broker, verify unauthorized denial and refresh/revocation, and retain standalone Workspace use. This is the **first** external acceptance goal after release, not work deferred to entire fleet completion. The single compact Hub menu and provider-independent fixed-context routing remain the product requirement; owner/agent plan separately. No real token, production account or payment was used by this draft.

## October 18 — universal Hub-to-MCP OAuth connection source verified; live acceptance open

Source PR #237 is a generic, opt-in provider OAuth connection path **inside the existing fixed-size Hub broker**. The Hub initiates RTC1 identity/OAuth discovery, DCR registration, PKCE sign-in, bearer verification, encrypted per-caller token storage and guarded issuer refresh. The same original H-3 `hub_search_tools`, `hub_describe_tool`, `hub_call`, and bounded `hub_batch` route optional OAuth-backed harmless reads, using the provider's existing RTC meta-tools rather than loading a provider's entire `tools/list` catalog into the agent. One agent Hub connection remains fixed regardless of 2, 100 or 10,000 advertised provider tools. Existing RTC 1 pass-backed setup and direct standalone servers remain unchanged. The owner and coding agent plan; Hub only authorizes, discovers and routes.

Source tests cover two independent mocked issuers, 10,000-tool fixed-menu behavior, protected TLS, issuer/caller/area/profile refusal, explicit provider refusal with no POST retry, one-time browser state, disposable PostgreSQL per-family token refresh, service identity and immutable scoped read audit. Full CI was green on the reviewed implementation head before the final documentation reconciliation; exact final PR head verification remains required. No live provider authorization, real Workspace OAuth call, write/monetary delegation, large OAuth result-handle acceptance, database migration or production deployment occurred. The specific current Workspace owner-to-Hub continuity checkpoint remains PENDING and must be checked early after an independently consented Workspace connection, not deferred to future fleet completion. RTC 1 remains frozen; OAuth is an additional supported transport, not a new compulsory server contract.

This is a substantial source implementation, **not completion of original H-2/H-3/H-4 external acceptance** and not a production-ready fleet claim. Any nonwriting features outside the tested source route and automatic provider refresh beyond an actual issuer's OAuth policy require separate genuine acceptance. No provider passes were revived and no real business data was changed.

## October 18 — generic onboarding review correction (source only)

Post-merge PR235 review found two real issues before release. RTC §1 preview/production manifests now map at the provider boundary to internal test/live, with original advertised labels shown; unknown or ambiguous duplicate environment mappings refuse, and production never maps to TEST. Registry and pinned issuer identity use the same mapping, so this is not a UI-only workaround. Existing TEST-only probe callers retain a TEST default and refuse production-only manifests; exact LIVE issuer inspection requests LIVE explicitly. Exact provider credentials and caller modes are unchanged. Non-read-only setup now rejects current callers without explicit write delegation before even public rediscovery or provider credential forwarding; OAuth owner inventory includes its stored delegation bit, default false on older schemas. Regression covers issuer aliases, cross-environment refusal and actual disposable SQL OAuth metadata. Required CI/review and real normal-flow acceptance remain independent. Nothing released or granted; zero full subsections/bundles claimed.

## October 18 — normal generic service setup repair (source; runtime acceptance open)

Owner clarification: historical forced/preconfigured TEST direct/relay/Sandbox calls prove that bounded transport only. They do not prove the Hub normally discovers, authorizes and connects a service. Source baseline22ae548, frozen plan02eb69e in H-2. Current private cloud adapter reports foundation ready, federation not configured and zero authorized upstreams; no real normal-flow connection is certified.

`/api/owner/connect-service` is the normal generic owner entry, linked from the Hub control center. The owner supplies a canonical HTTPS origin; DNS-pinned public RTC1 discovery reads the service's own name/prefix/counts/modes/profiles/areas, stages only public registry metadata and shows current owned Hub callers. A second independently authenticated same-origin approval explicitly chooses caller, service mode/profile/areas and its independently issued RTC pass. No built-in provider origin, family list or credential. Existing H-4 encryption and independently pinned whoami activation are reused, and H-3 dispatch remains authoritative. TEST and LIVE work without relabeling credentials; non-read-only requires an explicit write acknowledgment and existing caller/provider entitlement. No provider tool is executed by setup.

A changed manifest/registered origin, foreign or narrowed caller, duplicate/family-rotated existing grant or rejected provider identity refuses activation. Normal setup never silently replaces an active/staged grant; original explicit renewal/recovery controls remain required. No schema/env change, grant issuance or release was performed. Legacy `/api/owner/connect-workspace` remains compatibility-only and is no longer the normal control-center route. Two independent simulated services and disposable SQL tests remain engineering proof only. Actual checked release, normal owner discovery/authorization, real routed identity/read, denied boundaries and exact revocation remain OPEN. No complete subsection/bundle or real acceptance pass claimed.

## October 17 — owner-selected universal RTC LIVE reads (source PR; not deployed)

This bundle addresses the shared H-3/H-4 connection boundary using the existing RTC 1 manifest/registered-service dispatch, NOT custom per-provider Hub code. New owner-approved LIVE read callers (including separately write-authorized callers) may discover and invoke only metadata-validated nonwriting RTC tools under a genuinely independently issued, exact-mode/profile/area scoped provider pass; the workflow WRITE path stays separate. Identical test/live checks apply to native MCP, HTTPS, result handles and read audit. Source tests include two synthetic independent providers and disposable database scope/revocation; no real LIVE provider mutation, deployment or grant upgrade is claimed. Original H-3/H-4 two-provider acceptance, continued real Workspace grant and upstream renewable OAuth architecture remain separately OPEN.

The early Workspace continuity checkpoint was posted to [Workspace issue #205](https://github.com/Robinson-AI-Systems/google-workspace-mcp/issues/205#issuecomment-6242231814) and pinned in [Hub audit](audits/2026-10-17-workspace-continuity-checkpoint.md). Historical D-4 remains PASSED. Current production Hub is READY at 85da318d; original verified but unrevoked Workspace grant expired at 2026-10-17T12:45:03.846Z, so current post-release Workspace continuity remains PENDING rather than assumed from history. Original owner connections and production grants untouched. No off-cycle release authorized.

## October 17 — C-1 public workflow engineering assembled in PR #232 (source verification, not live acceptance)

The approved C-1 plan/execute/status/explicit-undo engine is now wired through
authenticated native `/api/mcp` and direct RTC `/api/tools/{name}`. Unlike the
original read-only federation, the C-1 write path resolves an expressly
write-enabled **current** Hub pass or OAuth session and the original separately
issued verified RTC provider grant. It fetches the exact tool's provider
metadata by DNS-pinned TLS, verifies the delegated profile, mode, tool/area and
declared write capability, then makes one independently guarded, pinned-TLS
provider POST per step. No Hub bearer is sent upstream. The same restrictions
are rechecked on previews, effects, readback and each inverse. OAuth user-chosen
write approval survives PKCE/refresh and can be revoked. Existing read-only
bearers remain read-only and the old H-3 read router never performs a write.

`hub_workflow_plan` calls every provider with dryRun=true and persists the
combined preview; `hub_workflow_execute` requires the exact matching spec,
unexpired plan and explicit confirmation, claims its durable SQL run/steps
before POST and stops after a refusal/unknown response. `hub_workflow_status`
reports only caller/grant-authorized safe receipts and unknown or interrupted
steps; no uncertain POST is automatically retried. `hub_undo_run` is a
separate explicit confirmation, reverses only recorded still-authorized
non-money inverses and reports irreversible/unknown actions rather than
inventing a rollback. Two independent simulated RTC issuers plus disposable
PostgreSQL prove the public path end-to-end. Native MCP/HTTPS and pinned write
transport have separate unit regressions, alongside the earlier independent
two-service engine crash/duplicate/undo tests. No real provider write was used.

**Release/acceptance gate:** The tested source is not yet the deployed Hub.
Additive migrations 022 (ledger), 023 (provider selected permissions, merged
in PR #233) and 024 (OAuth owner-approved writes), and a separately generated
32-byte base64url `HUB_WORKFLOW_KEY` are required on the protected host before
workflow execution can be enabled. Actual non-production READ/WRITE delegated
credentials must be issued *by each provider* and separately owner-verified.
Current production's read-only connection is not upgraded. Genuine deployed
two-service workflow/confirm/refusal/undo, provider guard, change-log readback,
revocation and checked release receipts remain OPEN. No spending, customer
data changes, live payment, production activation or off-cycle promotion is
authorized by this source PR. Do not certify actual provider acceptance
from simulated Postgres/provider tests.

## October 17 — H-4 owner-selected permission source merged in PR #233 (runtime release pending)

The owner explicitly approved correcting the Hub's developer-only TEST/read_only
restriction as a **product defect**, not permitting this coding agent to mutate
live accounts. A separate independently authenticated owner can now choose
read_only/everyday/full and TEST/LIVE when issuing a **new** Hub pass, with
an additional explicit acknowledgement required to delegate writes. Existing
Hub passes are unchanged and retain their database grants and revocations.
The owner setup can separately stage and verify exact original provider-issued
profile/mode/area-scoped RTC passes (the provider itself must have granted
writes), stored encrypted for the exact caller. Additive migration 023 permits
those scoped records without changing historic read-only rows. A separate
`resolveDelegatedWriteGrant` checks actual current Hub caller SQL, independent
verified provider grant, correct owner/service, issuer mode/profile, area
intersection and revocation before returning an in-memory provider pass.

**Boundary:** These are permission enrollment and resolution capabilities,
not live workflow execution. The serving Hub routes are still TEST/read_only;
OAuth/ChatGPT connection grant upgrade, native/HTTPS write routing and the C-1
workflow adapter remain IN_PROGRESS. H-4 original acceptance and external
two-service proof are OPEN. No existing bearer is silently elevated; no
provider write, production data change, expense or deployment occurred.
The separate C-1 draft PR #232 must be reconciled with this owner-permission
change before its final implementation and merge.

## October 17 — C-1 durable workflow kernel reviewed; original C-1 not complete

An approved C-1 plan was frozen against main `1f2fc4da4691a327b4c2632c709cad98df7c5c45` before code. Proposed additive migration 022 keeps exact caller/owner and immutable per-step grant fingerprints, preview receipts, one-claim dispatch and encrypted inverse metadata in a separate workflow ledger. A new internal engine requires independently verified service WRITE permission on every preview/commit/undo and does not use the existing H-3 read-only dispatcher. Real disposable PostgreSQL tests cover two simulated independent providers, double-submits, grant replacement, unknown no-retry outcomes and manual reverse undo. Source tests and CI are not yet independent authenticated external provider acceptance.

**C-1 remains IN_PROGRESS (zero complete predefined subsections claimed)**: the actual Hub native MCP and direct HTTPS workflow doors, end-user delegation and service-owned write/undo transport remain missing; current TEST/read_only Hub grants intentionally cannot execute them. No live/production mutation, privilege expansion, hosted migration, token, paid resource or release is authorized. K-3 optional, D-4 Workspace completed and H-3/H-4 two-service read acceptance separately remain as previously recorded.

## October 17 — H-5 source completion reviewed in PR #231; checked release outstanding

Current accepted hosted H-5 basic read from owner-approved SQL view migration 019 remains valid on live READY f6f916b8. Independent one-provider Workspace RTC TEST read is accepted, while two-service H-3/H-4 federation, direct/relay/Sandbox and full H-5 external acceptance remain OPEN.

PR #231 keeps historical H-3 audit and H-5 owner reads, adds optional exact tool/UTC interval filters in native MCP/HTTPS/independently password-verified owner view, and binds non-owner audit rows and pagination to current exact active sealed grant IDs rather than only service name. Revocation, renewal and cursor replay denial use the existing H-2/H-4 authorization resolver and disposable PostgreSQL proof. The current production deployment does not include PR #231; exact-head CI and merge/review gates remain independent from the later checked release. No hosted mutation or release is authorized. H-5 was already MERGED at #207 and must not be counted twice toward requested bundle totals.

## October 17 — L-4 guided-settings source merged; real owner use pending

Approved independent L-4 original local workflow planned at bfc6799f (planning SHA 9621d90), with visible headed browser, human-driven per-step approval/acknowledgment and exact advertised read-only RTC §11 verification. The intended implementation is local `rtool guide` only: no hosted Hub, pass/grant changes, provider writes or spending. PR #230 has completed exact-head CI and manual review and merged at 85da318d. L-4 source is MERGED; no owner browser/provider guided-setting acceptance has occurred. The main RTC H-1/H-2/H-3/H-4 two-service acceptance queue remains unchanged.

## Owner-requested documentation and Git closeout — October17 UTC

Updated current setup, architecture, owner inputs, roadmap and acceptance guides to match the verified Workspace D-4 receipt; preserved dated earlier observations as history. The refreshed exact housekeeping manifest archives reviewed development tips before SHA-leased deletion, protects main/live, existing archives and release markers, and rechecks open/concurrently advanced branches. Actual maintenance Action/remote readback belongs in this PR's permanent closeout comment. No new Hub release is requested; other Hub product and fleet obligations remain open.

## October 17 — final D-4 acceptance PASSED

All original D-4 route gates are now proven against the independent Workspace RTC service. This supersedes the historical pending verdicts below; their original evidence and criteria are retained. Full machine-readable receipt: [final route acceptance](audits/2026-10-17-d4-final-route-acceptance.json).

- Separate Codex local executor, Node24.19.0: original `scripts/agent-check.mjs`, expected/observed **direct**, all five checks, exit0 at `2026-10-17T00:47:41.439Z`.
- GitHub-only nonpersistent Vercel Sandbox, actual Node24.21.0: original runner, expected/observed **relay**, all five checks, exit0 at `2026-10-17T01:13:27.083Z`. Network policy permitted only `api.github.com`; an actual direct Workspace fetch was denied. Existing original Sandbox direct and native Hub evidence remains accepted from PRs #224/#226.
- Same new independent TEST/read_only/nonwriting Workspace pass revoked by the issuer at `2026-10-17T01:14:32.929Z`. Original local revocation probe returned exact HTTP401 `pass_revoked`, exit0 at01:14:43.007Z. Original encrypted `relayRoute` then returned the same `pass_revoked` error envelope, exit0 at01:14:45.484Z. The relay envelope is not an assertion about its outer HTTP status.
- Original executable source `f6f916b8f2f6a596583328540593f3098dc2ff27`; actual Workspace source `42afbaaf138d293d6042acd874c0fd3c32f7ce0e`. Original CLI/relay module graph is unchanged. No provider writes or product code changes.
- Independently inspected existing hosted and new temporary fine-grained GitHub token permissions: one private relay repository only, Metadata read and Issues read/write, no organization permissions. Existing hosted token was never extracted, regenerated or revoked. Original permission probe passed read/create/delete; its `leastPrivilegeVerified=false` correctly refers to what the probe alone cannot establish.
- Controlled signing-key rotation, issue_comment-only JSON/TLS webhook, exact immutable Workspace HTTPS origin and numeric actor227716942/issue4 binding were configured. Original signed ingress probe returned valid202 ignored / invalid401, zero RTC calls. Actual GitHub webhook delivery and encrypted roundtrip succeeded with deployment protection retained.
- Cleanup: Sandbox stopped; temporary issue4 closed with zero comments; webhook699295489 inactive; exact new automation bypass revoked; temporary GitHub agent PAT deleted and independently rejected with HTTP401; its Development-only Vercel entry now inert. Production `RELAY_SERVERS` and `RELAY_BINDINGS` are empty objects, disabling routing. Checked cleanup deployment `B3J1S9unM1S4LmHe4rbvJqzJ8hvc (deployment ID suffix)` is READY on the same original source. Existing hosted keys and standing Hub grant preserved; genuine native Hub `workspace_whoami` read passed again after cleanup.

**D-4 COMPLETE / HUB-D4 PASSED.** Other service fleet acceptance remains separate and open. No new application source release is required. No completion bundle count is claimed: this is newly executed original real-world acceptance and cleanup under the owner's explicit two-test request.

## October 16 — D-4 actual Sandbox direct + same-pass revocation acceptance

New genuine evidence against Workspace production `42afbaaf` and original
Hub source `f6f916b8`: the owner's disposable four-hour TEST/read_only
pass, limited to the `workspace` area, passed all five
`agent-check.mjs` gates on a short-lived, outbound-allow-listed Vercel
Sandbox (exit 0, direct route), then the *same* credential was revoked
by the Workspace issuer and the original `rtc-revocation-probe.mjs`
verified service-native HTTP 401 `pass_revoked` (exit 0).
The earlier duplicate temporary pass was also revoked, the Sandbox
stopped and the Dev-only test variable replaced with inert content.
The useful Hub Workspace grant remains verified, unrevoked and active.
This is independent real acceptance, not provider simulation.

D-4 **remains IN_PROGRESS** only for the original separate protected
local runner and genuine GitHub-only X25519 encrypted relay route:
private issue binding/actor, `RELAY_SERVERS`, `RELAY_BINDINGS`,
signed webhook/ingress and least-privilege repo token are not
configured/verified; do not claim encrypted relay acceptance.
The full exact evidence matrix and evidence provenance live at
`docs/audits/2026-10-16-d4-workspace-route-checkpoint.md`.
No new features or releases; no persistent test credentials.

## October 16 — D-4 Workspace remaining independent route acceptance

Source and deployment reconciliation: Hub `main=live=f6f916b8`, Vercel
READY; Workspace `42afbaaf`, RTC1. PR #224 previously accepted the
real native audited Hub-to-Workspace read. A new genuine TEST read
succeeded after the encrypted-only Workspace change; a write-tool
probe was denied before dispatch without creating a read-attempt
receipt. Preserved the existing active Hub grant.

D-4 remains IN_PROGRESS for separately credentialed original CLI
direct, encrypted private GitHub relay, Vercel Sandbox direct and
same-temporary-pass service-native revocation. No disposable pass
was issued or revoked. Relay is not bound; no named Sandbox exists.
See `docs/pr-cards/D-4.md` for the exact evidence and blockers.
No features, production configuration or release were changed.

## October 16 — owner-authorized immediate read-audit identity correction

The first genuine Hosted TEST `hub_provider_read` after the manual READY
release `516065c` reached the Hub's existing audited H-3 dispatch path
and refused before provider POST with `RTC audit storage unavailable`.
The root cause was an obsolete underscore-only server-name validator in
`rtc-read-audit.js`, inconsistent with the already migrated and verified
canonical `google-workspace-mcp` registration. The owner-authorized repair
reuses the same anchored canonical identity pattern as registry, history,
result storage and the Hub dispatcher, **retaining** the audit-before-POST
requirement and secure deny behavior. Hosted `hub_rtc_read_audit`
structure is already compatible. A new disposable PostgreSQL17 test
authenticates a real synthetic OAuth caller, stages its canonical
Workspace grant, persists both correlated durable attempt/outcome
rows, rejects invalid names, and verifies no secret is stored.
Do not mark genuine Workspace execution PASSED until the next checked
off-cycle Vercel READY revision is actually tested through the installed
ChatGPT Hub Cloud adapter. No provider writes, LIVE, or credentials
changed. This is incident maintenance, not a new completion bundle.

## October 16 — owner-authorized immediate read-only tool execution bridge

The Hub's production owner-first Workspace connection and real Hub-mediated
read-only tool discovery are VERIFIED on exact READY c654f58. The private
ChatGPT Hub Cloud adapter is still restricted to **outer** tool names
matching `^hub_[a-z0-9_]+$`; consequently it refuses attempts to
execute directly discovered `workspace_` RTC tool names even though the
Hub's H-3 router supports those names. The owner expressly authorized a
one-off immediate checked release of a remedy.

This compatibility update offers two new generic owned aliases:
`hub_provider_describe` and `hub_provider_read`. Cloud callers use their
existing `hub_call` with an outer alias and a separately supplied exact
provider tool name in nested args. The alias ONLY delegates to the *same*
federated `hub_describe_tool` / `hub_call` implementation that already
verifies owner, TEST scope, readOnly profile, independently encrypted
provider grant, exact tool metadata, audited one-shot POST, and post-read
grant revalidation. Aliases refuse nested hub_* recursion, malformed names,
extra selectors and non-TEST / write-enabled identities. Nothing mints,
exposes, upgrades, or weakens a provider credential; no LIVE or write path
was added. HTTP RTC and native JSON-RPC menus announce these owned aliases.

The final proof still requires actually invoking `hub_call` with
`name:'hub_provider_read'`, `args:{name:'workspace_whoami',args:{}}`
from ChatGPT on the newly READY promoted revision. Only that genuine
network read plus denial evidence qualifies for closure. An ordinary
green CI result does not replace real acceptance. Owner-approved manual
release requires exact-main CI and release-policy checks, ancestry,
nonforced expected-head live update and Vercel READY readback.

## October 16 — unified Hub → Workspace next-release transport readiness

**Observed production:** Hub live/READY `4b0a3d4` contains working owner recovery
and setup GET forms but 0 registered RTC services and 0 grants after the owner
submitted Workspace onboarding. Owner recovery was consumed once, provider
issued one valid `for_hub` read_only TEST nonwriting pass, and one TEST Hub
OAuth caller was active when tested. Workspace RTC manifest HTTP 200 matches
its actual service identity, prefix, tool count and deployed revision.
The incident is **not** proven to be a Workspace API permission failure.

**Root cause in Hub:** both `pinnedRtcJsonGet` (contract, whoami, catalog,
schema) and `pinnedRtcReadCall` (exact read POST) returned scalar DNS
addresses even when Node 22+/24 invokes the custom socket lookup with
`options.all=true`. Node rejects this before TLS. The prior mock transport
always used an empty options argument, so the tests falsely passed.
The source-only repair uses one shared socket-lookup adapter, checks ALL
resolved answers are globally routable IPv4, pins only one vetted address,
returns an address array to modern sockets, and preserves the legacy scalar
callback, original TLS hostname verification, deadlines, no redirects,
no proxy, and no automatic POST replay. Unit tests exercise modern/legacy
callback shapes on public contract, authenticated tool discovery/schema
and exact read POST; mixed private/public answers still refuse.

**Remaining real acceptance:** even once checked `main` is deployed, the
Hub owner must re-submit the same independently issued provider pass (in
the protected form; never paste it in chat). The pass will expire based
on its provider-issued timestamp, so an expired pass must be newly
owner-authorized. A protected POST cannot be synthesized from a pass
hash or the Hub owner verifier. Confirm a real stage/verify/active
grant and native Hub-mediated read after release before claiming done.
This audit remains separate from unexecuted D-4 acceptance.

## October 16 — owner-requested next-release Workspace preparation (PR #221)

Live production remained on previous b62ee937 while reviewed Hub owner page
and recovery fixes 4b0a3d4 awaited the next checked daily promotion. Independent
provider public contract RTC1 validated against Google Workspace READY
5c23755 (382 advertised tools); native Hub connector identity was authenticated
and its session refreshed, although the owner connection may expire again.
The hosted Hub migration 020 and 021 constraints are installed and verified.
The Workspace issuer's own read-only TEST pass store contains zero active
`for_hub` passes, so real inbound credential authority is still missing and
must be granted by the service owner via the protected pass issuer, never
manufactured in the Hub.

This pre-release integration test uses disposable PostgreSQL 17 with real
owner-authorized Hub OAuth issuance and token exchange, original Hub 020
migration, registered pending identity, AES-GCM grant sealing, TEST identity
activation and decryption, plus denial cases. Its provider transport is
synthetic and bounded; genuine read/denial/revocation work requires the
separately authorized provider-issued pass and exact checked deployment.
No Hosted service staging or grants were inserted; owner passphrase recovery
also remains pending the owner's private browser confirmation.

## October 15 — Owner mobile onboarding + protected recovery correction (proposed)

Owner's checked manual early promotion published merged source b62ee937 to
Vercel production READY/live. The protected recovery GET returned HTTP
400 Invalid request through Vercel's authorized share/bypass query because
the handler incorrectly rejected all GET query parameters. Reproduced via
Vercel control-plane protected URL fetch. This is a page display bug, not a
password or credential failure. Corrected GET ignores (never parses,
reflects or treats as approval) deployment-protection query values. Actual
recovery POST remains one-time, owner-limited, transactional and cryptographic.
Applied previously merged additive hosted migration 021 under authorized
recovery work; readback verified owner row unchanged and zero spent codes.
Vercel production sensitive recovery-code variable exists, but its value
was not read; one-time reset has NOT been submitted or accepted.

Owner rejected manually operating the three advanced registration, grants
and verification forms. New owner Connect Workspace page derives canonical
service identity/origin, read_only TEST scope, eligible exact Hub caller
and pinned TLS verification from approved source. First owner registration
requires only Hub passphrase; a Workspace-issued read-only pass is still an
independent service authorization and may be supplied once through that
same page. Absent/ambiguous Hub callers, tampered origin, write-mode
service passes and pinned identity failures fail closed. No provider
credentials are minted from Hub approval. Source only; genuine live
routed reads, replay denial, TEST provider setup and scoped grant activation
remain open. Hosted SQL migration 020 must be applied through authorized
deployment procedure before hyphenated Workspace registry staging.

## October 15 — owner-approved passphrase recovery (pending deployment)

Owner reported that the Hub passphrase was unknown. Independently checked:
`hub_owner_credentials` had one correctly formatted scrypt verifier, created
October 13 for the configured owner ID, and the original setup activation
expired October 14. The actual passphrase is not recoverable from the hash.
There was one active OAuth session at that check; recovery must **not**
silently erase grant/session records, secrets or current verifier before owner
authentication succeeds. Owner explicitly approved a replacement.

A protected one-time recovery flow is added at `/api/owner/recover` and a
separate additive migration `021-hub-owner-recovery.sql`. This is owner
authentication maintenance, not a completion/product bundle. The original
passphrase stays valid until the new one is saved in the browser using the
independent recovery code configured by the owner in the existing Hub
Vercel project's **Production / Sensitive** variable
`HUB_OWNER_RECOVERY_CODE` (exactly 43 base64url characters; generate via a
password manager, not chat). Configure the plain Production
`HUB_OWNER_RECOVERY_EXPIRES` as an ISO 8601 UTC date/time no more than
72 hours ahead, and ensure `HUB_OWNER_SCRYPT` is absent (the pre-existing
owner's database verifier is authoritative). Do not disclose the recovery
code, new passphrase, expired activation token or credential verifier.

Once the exact reviewed source is live READY, migration 021 has been
independently applied and fresh Vercel environment values are in the serving
deployment, the owner may open
`https://robinsons-toolkit-relay.vercel.app/api/owner/recover` directly,
enter their own one-time code and new passphrase, then use the ordinary
owner setup forms. The form refuses missing/expired/wrong codes, malformed
inputs, wrong deployment environment and code reuse. It uses the existing
no-store/CSP/rate-limited HTTPS route, owner-global attempt budget, scrypt
and a transactionally consumed keyed digest with a unique DB constraint.
Errors never return the input or verification hash. No OAuth session is
implicitly revoked. Existing active sessions should be reviewed separately
if unauthorized access is suspected. After use or expiry, remove the
temporary environment variables through owner control plane and only after
serving source/config is reconciled. Never use raw SQL to overwrite owner
credentials, disable owner protection, or ask for codes in chat.

Hosted acceptance (not satisfied by source CI): confirm exact deployment,
installed migration and Vercel variables; genuine owner's protected POST;
owner sign-in using the new passphrase; rejected reused recovery code; then
safely remove recovery config. Manual live release not authorized solely
by this approval; standard checked daily deployment policy remains binding.


## October 15 — canonical Workspace RTC server identity repair (source-only)

The owner reported that no Workspace target was configured in Hub. Verified the
connected Hub TEST namespace and hosted Neon inventory: **zero registered servers
and zero encrypted upstream grants**; Hub owner credentials are configured.
This is real missing owner TEST integration, not missing Workspace standalone
MCP functionality. Serving Hub production remains READY at live source
`8169af07afa2df4fe9cacb195b5382f9c04fc7e0`; main at inspection
`0642e8cfe0b4d28790d41ffb6e250ff2977a1098` with no open PRs.

Root cause established independently from RTC manifest source: Workspace
advertises `server: google-workspace-mcp`, `prefix: workspace`. Hub H-2
registry, grant, search, scope and encrypted result name guards used a
different underscore-only server grammar, so the secure owner setup path
could not register the canonical service. Repair source uses one shared
bounded server identity grammar in app, separately preserves underscore-only
RTC prefixes/tool names/areas, and adds checked migration 020 to update the
two hosted DB constraints. Regression coverage includes owner staging and
permission-denial, TLS-pinned RTC 1 manifest probe, grant form, federated
selection, PostgreSQL registry and encrypted result pages.

This is a needed compatibility/TEST acceptance blocker repair, **not a
completed product bundle**. A merged source fix alone cannot create or
approve any live Hub target. Required exact-head CI/review, checked future
release, hosted migration application, independent owner setup and service-issued
TEST read_only grant, scoped activation, genuine Hub read/denial/revocation
and permanent acceptance ledger are separate OPEN steps. No credentials,
provider mutations, LIVE activation, paid capacity or manual release are
authorized by this correction.

### Release-needed owner escalation — October 15

Owner permits manual-release requests only after every independently eligible
authorized task is finished and release would enable a concrete next completion task.
Record source gaps while continuing implementation, deployed acceptance, reviews,
merges, cleanup and records; prepare the exact checked target before asking.
The read-only planner distinguishes source absent from live, source already in live
but not serving, and unknown provenance/history. No manual release is preauthorized;
continue independent work and reassess acceptance after actual READY deployment.

## Owner-requested product completion workflow correction — October 15

The Google agent's repeated 0/1 exits exposed a shared code-only bundle assumption.
This repository now retains normal ENGINEERING workload guides and adds explicit
COMPLETION accounting for substantial NEW original acceptance/configuration proof,
possibly with zero production lines. The existing card freezes complete criteria
and exact queue IDs; committed ledger deltas must preserve source, scope and gates.
Old code, old passes, audits, isolated probes and pending/partial outcomes count zero.
No new phase/features or scope approval may be invented to meet a workload number.

N supplements the WHOLE workflow: perform every currently ready authorized obligation
in existing priority/dependency order even after N is reached. A planned substantial
acceptance outcome can count once, never excuse other ready acceptance or closeout.
Reconcile original requirements once; do not repeatedly audit already-proven code.
A future real-operation date or external sign-off does not prevent eligible source
work/synthetic proof. Only actual optional dependencies may be bypassed as optional.

This is scoped workflow maintenance, not a product audit or declaration that this
project is near completion. Existing roadmap, unfinished work, provider acceptance,
owner inputs, fixture ownership, release policy and authorization limits remain.
No queue row is marked PASSED, no provider call/release/activation/spending performed,
and zero product bundles claimed. Full exact-head/local checks, review/merge and
final-main verification remain required. See docs/pr-cards/SESSION-WORKFLOW.md.

## October 15 — L-3 guarded local headless browser source, PR #210 verified

## Owner-requested execution efficiency / parallel CI maintenance — October 15

Preserve substantial outcome scope and complete acceptance. Consolidated local
capability/publication diagnosis and early real-boundary fixture preparation reduce
avoidable retries. Independent verification families run in parallel with original
required aggregate names; new topology/timeout regressions and measured 180-second
root phase budgets preserve fast feedback as coverage grows. No tests/assertions,
provider gates, immutable pins, releases or production behavior are waived.
Existing session/CI checks and final-main verification remain mandatory. This is
maintenance, zero product bundles or genuine deployed/provider acceptance. See
SESSION-START and the existing SESSION-WORKFLOW card for evidence and procedure.


## Owner-requested bundle scope accounting correction — October 15

Operational maintenance, zero product bundles/subsections: preserve an inspected
pre-code plan in the existing execution card, compare all original criteria with
actual new engineering, retain undersized completions as contributions, and require
explicit review of substantial-work exceptions. `session:bundle` checks frozen Git
plans and delivery accounting; `check:session` includes behavioral regressions.
Existing CI/review/merge gates remain required. No provider/deployed acceptance,
release, activation or spending is claimed. Existing work and acceptance queues
remain authoritative; their obligations are unchanged. See SESSION-START and
SESSION-WORKFLOW maintenance card for procedure, proof and publication boundary.


## Acceptance-first session tooling — October 15, 2026

Follow-up: deployment provenance is shared by planning and accounting and is
verified even for an empty queue. Unknown/missing/divergent refs fail closed;
the empty-queue native regression preserves partial-release support.

Owner-authorized cross-repository workflow repair: session status now presents
per-deployment acceptance actions before roadmap work, separately lists waiting
checks, and validates complete/stale-free temporary acceptance accounting.
SESSION-START is authoritative for sequencing and final closeout; push checkpoints
continue into required obligations. This maintenance completes no product bundle,
closes no provider/deployed acceptance, changes no release/approval gate, and
preserves concurrent roadmap work and existing evidence. Focused native script
regressions and required exact-head CI/review must pass before merge.


Reconciled previously unfinished L-3 against main after explicit owner direction
to finish and merge. The optional `rtool mcp --local` Playwright Chromium
door requires a valid owner-selected exact HTTPS or loopback origin allowlist
and locally installed Playwright. Four compact tools inspect status, visit,
list approved links or save a confirmed create-only owner-root PNG. Fresh
browser contexts, blocked service workers/WebSockets, download/pop-up refusal,
origin-guarded GET/HEAD-only routes, output bounds and cleanup are verified
with injected browser behaviors and real filesystem tests. All other newer
main work and its acceptance records preserved.

L-3 PR #210 first CI found and reproduced one wildcard-origin parser defect
(WHATWG URL accepted '*' as a hostname label); corrected fail-closed validation
without weakening the test. Exact-head source CI passed at
`e5eef06ef07f6aaf5d934e4dd7fc12af2b1577eb`: `ci`,
`release-policy`, check/lint/index/secrets, unit (801 tests), disposable
PostgreSQL 17, and both pinned Stripe owner HTTP/SQL compatibility jobs.
No open review threads or submitted reviews as inspected; final publication
commit must pass its own gates before merge. On successful PR #210 merge,
L-3 source is MERGED; no live-owner acceptance is inferred.

Current verified release separation: Vercel production READY
`8169af07afa2df4fe9cacb195b5382f9c04fc7e0` from `live`
(independently checked Vercel production deployment); source main
`a66e814554c04ded17dd1ea234a6a4e58bc4338a` before #210.
The custom Hub TEST cloud adapter connected and reported `mode:test`,
`allowWrites:false`, RTC 0, `upstreamEnabled:false`, zero verified RTC
grants/targets. These adapter metadata reads do NOT prove genuine RTC 1
direct, encrypted private relay, Sandbox or revocation acceptance. All **20 of 20** recorded release-acceptance minimum source revisions
were explicitly compared against verified READY/live
`8169af07afa2df4fe9cacb195b5382f9c04fc7e0` on October 15 and
were **confirmed in its deployed ancestry** (including all H-3 and H-4
minimum revisions). The `main`/`live` gap **cannot be used to defer**
any of those tests. All 20 rows remain PENDING only because their
specific independent owner/provider TEST grants, verified RTC 1 upstream
targets, protected runner evidence, installed hosted migration proof or
owner-confirmed fixture steps have not been furnished/performed per each
row's `gates` and `procedure`. Current custom Hub TEST cloud
connection proves only RTC 0 foundation/metadata, with zero upstream
targets; it is not RTC 1 or direct/relay/Sandbox read acceptance.

Next: in an owner-approved protected non-production context, verify
service deployment identity and issue the actual scoped TEST grants,
stage/verify genuine Hub RTC 1 targets and applicable hosted migrations,
then execute each queue row's read/denial/revocation/readback/cleanup
procedure. Do all independent routes separately. Check public fleet
GET /api/contract from an authorized runner: attempted web-based
observation on October 15 could not access all five protected inventory
origins, so it supplies **no** status/pass evidence. Keep all rows OPEN;
do not require newer unreleased L-2/L-3 code for their already-deployed
H-3/H-4 behavior.

Actual owner-machine
Chromium execution remains OPEN external acceptance, distinct from source proof.
No hosted browser, production activation, provider money-out or spending.

### October 15 — owner-requested bundle guidance consistency review

Reviewed current main 8169af07afa2df4fe9cacb195b5382f9c04fc7e0. Aligned existing governing instructions, session
procedure and applicable playbook/card/recipe references: cards define approved
scope; related whole subsections form coherent bundles; PR splits need concrete
migration/dependency/safety/reviewability reasons. Removed stale numeric ceilings
and blanket one-risk/one-migration fragmentation rules where present. Session target
comes from the current owner, not PR count; incidental fixes/checkpoints do not end
an unfinished bundle. Remaining engineering must not be hidden as external proof.
Removed a stale generic session sentence that called future work maintenance.
All original subsection IDs, roadmap order, source/provider acceptance, independent
approval/guard/cleanup rules, CI/review and hosting/cost gates remain unchanged.
Dated PR-count instructions/credits below are historical to their original
sessions, never standing quotas or credits toward the current target.
This is explicitly requested guidance maintenance, zero product bundles; no provider
operation or release. Required exact-head checks and review disposition govern merge.
Preserve concurrent implementation branches; resume actual current main and the
implementing agent's active approved outcome after reading this alignment.


## H-4 exact SQL across native MCP and direct HTTPS — source acceptance candidate

A real disposable PostgreSQL integration runs two independently staged and
locally verified synthetic provider RTC 1 grants, one Hub pass, a separate
OAuth PKCE caller and refresh family through actual SQL grant selection,
discovery, schema, GET/POST, batch, durable RTC audit and stored result-page
revocation. Both native MCP handler and HTTPS broker use the same production
federation and grant resolver with injected harmless TEST-only transport
implementations. Attempts and denied/widening tools recheck effective current
service-area/profile policies after awaited metadata operations; stale actors
or revoked credentials cannot reuse previously cached authorization. A provider
never sees the Hub's own OAuth or owner password. The new native-handler
injection seam is server-internal, unavailable to untrusted HTTP callers and
defaults to the existing production implementation.

Source CI/PG gate is the only proof this establishes. Exact deployed main/live
revisions, owner-authenticated real two-provider TEST reads, provider-side
grant issuance/denial and all three independent direct/relay/Sandbox routes
remain OPEN. No RTC 0 alias is rebranded as RTC 1, and no LIVE provider or
money transfer path is authorized. Full H-4 release acceptance must still be
separately checked; no external acceptance row is closed by these fixtures.


## H-4 owner-only consolidated control center — source implementation

The new `/api/owner/dashboard` GET serves only a static mobile-viewport form.
Each private POST repeats independent owner password verification and shared
SQL lockout before reading bounded pass, OAuth family, staged/active grant,
current service-area/profile, audit and H-3 readiness records. Owner identifiers
come only from the configured owner, never from the browser. Sections are
isolated on database migration/fetch failure and report unavailable rather
than an empty or successful provider state. The UI never loads provider APIs,
reuses an authenticated session, sends/prints a pass, or performs writes by
itself. Scope action forms POST to existing independently verified owner
routes, so the newest SQL policy and grant are checked again before any
irreversible reduction/revocation; all credentials must be entered afresh.

Bounded source regression tests cover owner/password/method/selector refusals,
no-store/CSP, script escaping, partial database outage, metadata projection,
mobile HTML action forms, current disposable SQL grant readback, no secret
publication and readiness explicitly UNVERIFIED. Existing owner pages link
to the center; no host-only or browser control is silently activated.

H-2/H-3/H-4 source engineering and external deployment remain separate.
Current Hub connector advertising RTC 0/upstreamDisabled cannot close genuine
connected direct, relay, Sandbox and two-service authenticated TEST proof.
This is one connected H-4 owner workflow improvement, not an invented new
batch subsection, not a provider or production activation, and not yet full
H-4 acceptance. CI/review evidence is required before merge.


## H-4 atomic owner multi-service area reduction — source implementation

Existing H-4 permission subsection remains IN_PROGRESS. The verified owner can
now preview and atomically narrow 1–10 individually registered TEST service
areas on one Hub pass or an entire OAuth refresh family. The owner submits
canonical service:area|area pairs; duplicated service names, invalid areas,
missing identification and unauthorized owners refuse before any commit.
Previews are metadata-only and do not become durable approval tokens. The
separate authenticated commit acquires the same PostgreSQL client, orders
services canonically, and runs the original row-guarded service-specific
reduction, audit and encrypted-result invalidation statements inside one
BEGIN/COMMIT transaction. A late refusal or database error ROLLBACKs all
prior service changes, audit inserts and page deletions; all service grants
are checked again at execution time. OAuth policy reductions propagate to
all refresh generations as before. This is not external provider rollback.

Evidence: unit form/refusal tests and throwaway SQL tests for both caller
kinds, preview purity, late failure rollback, encrypted handle invalidation,
current grant narrowing, audit accounting and refresh. The checked exact-head
CI/review is required before source merge. Hosted adoption, migration 018,
verified provider deployment revisions and actual direct/relay/Sandbox TEST
reads stay in the preexisting acceptance queue, not satisfied by fixtures.

## H-4 owner-selected initial service-area restrictions — source candidate

Initial pass and OAuth PKCE consent accept per-service area ceilings,
persisting across OAuth authorization-code exchange and every refresh.
Migration 018 adds the one-time OAuth-code scope column. Previously
installed 015 retains the caller/session policies. Missing schema must
fail closed. Provider credentials, independent read_only service grants,
spending and LIVE remain unchanged; real deployed provider/direct/relay/
Sandbox TEST acceptance remains PENDING separately from synthetic CI.

## L-1 namespace diagnostics and confirmed plan log capture — source candidate

The optional local developer sandbox can explicitly probe a read-only Bubblewrap
namespace instead of treating installation as runtime readiness, and confirmed
multi-step plans can write bounded create-only step logs without exposing their
content in MCP results. Monotonic total deadline and early-stop semantics remain
in force. Kernel/real-machine acceptance is still OPEN; no hosted changes or
provider permissions are granted.

## H-4 initial profile selection before pass or OAuth PKCE consent — source candidate

Owner consent and one-time pass issuance can include explicit read_only or
disabled per-service ceilings. Each policy is bound to the initial identity
and carried across OAuth code exchange and refresh; a missing hosted
migration must not fall back to broad issuance. Pending genuine owner and
service-origin TEST acceptance remains in the existing H-4 queue.

## H-4 caller-specific per-service profile restrictions — source candidate

Hub pass and OAuth family owners can make a selected TEST/read_only service
permanently unavailable or explicitly retain read_only; original provider
credentials never widen. New OAuth refresh sessions carry the same profile
policy; active SQL discovery, dispatch, result reauthorization and owner
scope preview enforce it. Migration 017 and actual owner/provider TEST
acceptance remain OPEN. No LIVE write, spend or upstream changes.

## L-1 sandboxed sequential confirmed plans — source candidate

The opt-in Linux bubblewrap-only command door also supports explicit
confirmed plans of up to three bounded developer subprocesses, executed
in order in fresh isolated namespaces, with early stop on failure and no
implicit rollback. Source tests do not prove a real host namespace works.

## L-1 isolated opt-in local subprocess source — proposed

A new confirmed, Linux-bubblewrap-gated `local.shell_execute` allows
bounded developer tool subprocesses ONLY in explicitly enabled local roots.
It has no unsandboxed fallback and does not inherit host cloud credentials
or network access. A separate owner-approved create-only capture file
supports long command logs. CI's injected process tests prove only source
routing, not real Linux kernel isolation; L-1 remains IN_PROGRESS until
real-world sandbox acceptance and original shell limits are confirmed.

## Owner-requested design detail — October 14, 2026

Completed a code-grounded remaining-design review in `docs/implementation-contracts/IMPLEMENTATION-GUIDE.md` and linked
it from AGENTS. Concrete per-subsection state, input/output, failure/recovery,
file integration and test contracts supplement existing approved designs. No
runtime code, roadmap status/dependencies, acceptance queue, credentials,
resources, production switch or release changed. No completed product batch
subsection is claimed. Implementing sessions resume the authoritative roadmap
order, reconciling current main/concurrent cards and actual owner inputs first.
This dated design note is not a new implementation priority or replacement handoff.

Reconciled the concurrent implementation merge without changing its source,
roadmap state, evidence or active agent branch.
## L-2 local Ollama — source implementation pending exact-head CI

Local `rtool mcp --local` conditionally exposes a six-tool Ollama capability
only if the local CLI environment supplies a valid HTTP loopback
`OLLAMA_BASE_URL`. Absent/invalid config disables Ollama only; other local
file/Git utilities continue working. Fixed model list, running models,
version, generate, chat and embedding calls use an already-downloaded
digest-identified local model, no automatic cloud/download/provider fallback,
no credentials, no proxy routes, no externally supplied endpoint, no
unbounded/streaming response. Expensive output must be complete within
bounded inline limits or saved via existing confirmed create-only private
file handler under the selected approved local root.

Real ephemeral loopback HTTP and opted-in local MCP tests exercise requests,
failures, model filtering, confirmed captures and unchanged other local tools.
Source CI/review/merge gates remain necessary. Actual owner's PC/Ollama model
availability, local resource/GPU behavior and L-1 OS Bubblewrap isolation
must be tested independently; neither is asserted by synthetic tests.
No Vercel-hosted Ollama, provider writes, autonomous spending or production
activation. Concurrent independent documentation PR #208 preserved.

## H-5 source implementation — PR #207 (external acceptance OPEN)

The new owner/agent history reads Hub's existing mandatory H-3 RTC audit
attempts and outcomes through additive SQL view migration 019. It gives the
verified TEST caller only currently authorized service history; revocation
and later service reductions reauthorize against active independently issued
RTC grants before every page. HMAC-signed caller/filter/keyset cursor expires
after five minutes. Native MCP and HTTPS use the same fixed schema and
real SQL guard; owner HTML requires a fresh independent password on every
page. Optional *single selected* provider history runs only when a matching
read-only provider tool was actually advertised, through the existing
non-retrying pinned H-3 RTC dispatcher. Provider refusal/timeout/missing
capability is disclosed without falsifying the Hub's durable receipt.

Current source branch: `ai/gpt6/h5-audited-recent-changes`. The prior stall
after a source-only checkpoint is addressed in SESSION-START with a mandatory
recover/finish-this-subsection rule and exact pointer on H-5's card.
H-5 source exact-head CI and full disposable PostgreSQL gates must pass before
engineering status can advance. Deployed 019, genuine independent service
TEST read and provider log linkage, direct/relay/Sandbox and H-4's existing
acceptance queue remain separately OPEN; no production activation or spending.


## H-4 exact SQL across native MCP and direct HTTPS — source acceptance candidate

A real disposable PostgreSQL integration runs two independently staged and
locally verified synthetic provider RTC 1 grants, one Hub pass, a separate
OAuth PKCE caller and refresh family through actual SQL grant selection,
discovery, schema, GET/POST, batch, durable RTC audit and stored result-page
revocation. Both native MCP handler and HTTPS broker use the same production
federation and grant resolver with injected harmless TEST-only transport
implementations. Attempts and denied/widening tools recheck effective current
service-area/profile policies after awaited metadata operations; stale actors
or revoked credentials cannot reuse previously cached authorization. A provider
never sees the Hub's own OAuth or owner password. The new native-handler
injection seam is server-internal, unavailable to untrusted HTTP callers and
defaults to the existing production implementation.

Source CI/PG gate is the only proof this establishes. Exact deployed main/live
revisions, owner-authenticated real two-provider TEST reads, provider-side
grant issuance/denial and all three independent direct/relay/Sandbox routes
remain OPEN. No RTC 0 alias is rebranded as RTC 1, and no LIVE provider or
money transfer path is authorized. Full H-4 release acceptance must still be
separately checked; no external acceptance row is closed by these fixtures.


## H-4 owner-only consolidated control center — source implementation

The new `/api/owner/dashboard` GET serves only a static mobile-viewport form.
Each private POST repeats independent owner password verification and shared
SQL lockout before reading bounded pass, OAuth family, staged/active grant,
current service-area/profile, audit and H-3 readiness records. Owner identifiers
come only from the configured owner, never from the browser. Sections are
isolated on database migration/fetch failure and report unavailable rather
than an empty or successful provider state. The UI never loads provider APIs,
reuses an authenticated session, sends/prints a pass, or performs writes by
itself. Scope action forms POST to existing independently verified owner
routes, so the newest SQL policy and grant are checked again before any
irreversible reduction/revocation; all credentials must be entered afresh.

Bounded source regression tests cover owner/password/method/selector refusals,
no-store/CSP, script escaping, partial database outage, metadata projection,
mobile HTML action forms, current disposable SQL grant readback, no secret
publication and readiness explicitly UNVERIFIED. Existing owner pages link
to the center; no host-only or browser control is silently activated.

H-2/H-3/H-4 source engineering and external deployment remain separate.
Current Hub connector advertising RTC 0/upstreamDisabled cannot close genuine
connected direct, relay, Sandbox and two-service authenticated TEST proof.
This is one connected H-4 owner workflow improvement, not an invented new
batch subsection, not a provider or production activation, and not yet full
H-4 acceptance. CI/review evidence is required before merge.


## H-4 atomic owner multi-service area reduction — source implementation

Existing H-4 permission subsection remains IN_PROGRESS. The verified owner can
now preview and atomically narrow 1–10 individually registered TEST service
areas on one Hub pass or an entire OAuth refresh family. The owner submits
canonical service:area|area pairs; duplicated service names, invalid areas,
missing identification and unauthorized owners refuse before any commit.
Previews are metadata-only and do not become durable approval tokens. The
separate authenticated commit acquires the same PostgreSQL client, orders
services canonically, and runs the original row-guarded service-specific
reduction, audit and encrypted-result invalidation statements inside one
BEGIN/COMMIT transaction. A late refusal or database error ROLLBACKs all
prior service changes, audit inserts and page deletions; all service grants
are checked again at execution time. OAuth policy reductions propagate to
all refresh generations as before. This is not external provider rollback.

Evidence: unit form/refusal tests and throwaway SQL tests for both caller
kinds, preview purity, late failure rollback, encrypted handle invalidation,
current grant narrowing, audit accounting and refresh. The checked exact-head
CI/review is required before source merge. Hosted adoption, migration 018,
verified provider deployment revisions and actual direct/relay/Sandbox TEST
reads stay in the preexisting acceptance queue, not satisfied by fixtures.

## H-4 owner-selected initial service-area restrictions — source candidate

Initial pass and OAuth PKCE consent accept per-service area ceilings,
persisting across OAuth authorization-code exchange and every refresh.
Migration 018 adds the one-time OAuth-code scope column. Previously
installed 015 retains the caller/session policies. Missing schema must
fail closed. Provider credentials, independent read_only service grants,
spending and LIVE remain unchanged; real deployed provider/direct/relay/
Sandbox TEST acceptance remains PENDING separately from synthetic CI.

## L-1 namespace diagnostics and confirmed plan log capture — source candidate

The optional local developer sandbox can explicitly probe a read-only Bubblewrap
namespace instead of treating installation as runtime readiness, and confirmed
multi-step plans can write bounded create-only step logs without exposing their
content in MCP results. Monotonic total deadline and early-stop semantics remain
in force. Kernel/real-machine acceptance is still OPEN; no hosted changes or
provider permissions are granted.

## H-4 initial profile selection before pass or OAuth PKCE consent — source candidate

Owner consent and one-time pass issuance can include explicit read_only or
disabled per-service ceilings. Each policy is bound to the initial identity
and carried across OAuth code exchange and refresh; a missing hosted
migration must not fall back to broad issuance. Pending genuine owner and
service-origin TEST acceptance remains in the existing H-4 queue.

## H-4 caller-specific per-service profile restrictions — source candidate

Hub pass and OAuth family owners can make a selected TEST/read_only service
permanently unavailable or explicitly retain read_only; original provider
credentials never widen. New OAuth refresh sessions carry the same profile
policy; active SQL discovery, dispatch, result reauthorization and owner
scope preview enforce it. Migration 017 and actual owner/provider TEST
acceptance remain OPEN. No LIVE write, spend or upstream changes.

## L-1 sandboxed sequential confirmed plans — source candidate

The opt-in Linux bubblewrap-only command door also supports explicit
confirmed plans of up to three bounded developer subprocesses, executed
in order in fresh isolated namespaces, with early stop on failure and no
implicit rollback. Source tests do not prove a real host namespace works.

## L-1 isolated opt-in local subprocess source — proposed

A new confirmed, Linux-bubblewrap-gated `local.shell_execute` allows
bounded developer tool subprocesses ONLY in explicitly enabled local roots.
It has no unsandboxed fallback and does not inherit host cloud credentials
or network access. A separate owner-approved create-only capture file
supports long command logs. CI's injected process tests prove only source
routing, not real Linux kernel isolation; L-1 remains IN_PROGRESS until
real-world sandbox acceptance and original shell limits are confirmed.

## Owner-requested design detail — October 14, 2026

Completed a code-grounded remaining-design review in `docs/implementation-contracts/IMPLEMENTATION-GUIDE.md` and linked
it from AGENTS. Concrete per-subsection state, input/output, failure/recovery,
file integration and test contracts supplement existing approved designs. No
runtime code, roadmap status/dependencies, acceptance queue, credentials,
resources, production switch or release changed. No completed product batch
subsection is claimed. Implementing sessions resume the authoritative roadmap
order, reconciling current main/concurrent cards and actual owner inputs first.
This dated design note is not a new implementation priority or replacement handoff.

### Owner workflow clarification — October 14, 2026

PR workload is counted in whole predefined batch subsections from the approved
roadmap/design, never technical slices or packet checklist tasks. Partial
subsections count zero complete; retain all remaining engineering and separate
external acceptance. Session PR count and scope come only from the current
owner prompt, with no standing quota or PR-number alignment. Historical PR
counts below record earlier work and do not instruct future sessions.
This owner-requested maintenance changes guidance/report wording only; required
CI/review, security, provider, spending and release gates remain unchanged.
Focused reporting tests passed locally; exact-head full Actions gates are required
before merge. No product subsection, deployment or provider acceptance claimed.

## L-1 compact workspace inspection and patch preview — source candidate

New opt-in-only bounded local recursive tree, compact multi-file reads and
side-effect-free exact conditional patch preview support real coding-agent
workflows without unbounded schemas, subprocesses or remote providers.
Local source/CI tests are distinct from external-machine and OS sandbox
acceptance; L-1 general shell remains IN_PROGRESS.

## L-1 local read-only Git inspection — source candidate

Opt-in local agents can read bounded working/staged source patches, immutable
commit-file snapshots, tracked paths and path-specific history using fixed
Git subcommands. Existing local no-provider and no-shell policy remains in
force. Real local fixture testing is distinct from any OS-wide sandbox or
external-machine proof.

## L-1 opt-in confirmed local refactor operations — source candidate

The local MCP gains exact-match conditional patch, same-root no-overwrite
rename-like move and SHA-confirmed file deletion in explicitly enabled
local folders. No hosted Hub API, remote account or provider grant changes.
Local shell general sandbox acceptance remains pending; these local tests
are not proof of OS-wide isolation from noncooperating processes.

## H-4 owner-safe active-service grant enrollment and renewal — source candidate

An active, owner-owned service can receive a separately independently issued
TEST/read_only pass for a new caller, or stage one replacement without taking
its current caller offline. Identity is checked by pinned whoami before a
transactional old-credential retirement, prior RTC result deletion, new
verification and immutable redacted audit. Unverified staged grants are
noncallable and independently cancelable. Hosted SQL 016 and genuine service
TEST acceptance remain OPEN; no live authorization or spending.

## H-4 per-service Hub caller area ceilings — source candidate

H-4 owner controls add an irreversible service-specific area overlay for
Hub passes and OAuth refresh families, with current-SQL intersection applied
to discovery and call routing, encrypted result invalidation, and audit.
Migration 015 and independent two-provider TEST refusal remain OPEN; no
hosted credential, release or service-owned authority is assumed. H-4 remains
IN_PROGRESS pending complete multi-door source proof and real hosted checks.

## H-4 permanent OAuth family server narrowing — source proposal

Owner-only one-way reduction now updates every existing PKCE refresh family
session under SQL's conditional subset guards, with a durable audit and removal
of encrypted RTC result pages attached to excluded services. An already
issued broad actor must fail active SQL service checks, and refreshed access
tokens inherit the narrowed selection. Concurrent conflicting reductions
cannot reinstate another server. Scope changes do not re-encrypt service grants,
contact providers, or activate LIVE. Hosted migration 014 and genuine TEST
read/denial remain queued; H-4 remains IN_PROGRESS.


## H-4 OAuth connection-family owner management — source PR pending

Owner-only OAuth family metadata now shows the latest live session for each
family without access/refresh bearer, digest or upstream service secret. The
owner can revoke the entire selected TEST family with one conditional SQL
operation that also deletes prior encrypted RTC result-page handles and
records an immutable nonsecret audit. Replay and stale grants stay refused;
reissuance requires a fresh independently owner-approved PKCE authorization
and freshly scoped upstream service grants. Additive SQL 013 is required for
this owner action and fails closed when absent. Synthetic unit and isolated
PostgreSQL tests do not install hosted migrations or close real RTC acceptance.

## October 14 session handoff — source #188–#192, finish exactly five gated PRs

Verified main before #192: a745623a91363eb541e06f05e749030158494932 (#191 merged). Earlier four session merges: #188 c8d0fee389ebca0cbc5227a35e0ee421d7d921c1 (L-1 bounded local read commands), #189 099ddba2fec173c2598ad5a2448c051812c6236e (H-4 Hub pass selected RTC servers), #190 10a900ff80e2538cb8f499f907236ee672fd2760 (H-4 OAuth refresh family scopes), #191 a745623a91363eb541e06f05e749030158494932 (H-4 owner-only atomic server narrowing). PR #192 must independently pass exact-head unit, real disposable DB, check/index/lint/developer, original Stripe SQL/HTTP and release-policy, resolve review threads, and merge before the session's five-PR outcome can be claimed. Actual fifth merge SHA is established only from GitHub, not predicted in this document.

Approved source work under H-4 continues with owner-only, irreversible area ceilings on separately issued encrypted RTC read-only grants, preserving original AES-GCM associated data and deleting previously generated encrypted RTC result handles in the same SQL statement as nonsecret audit. SQL migration 012 is additive and **not hosted installed**. Source/CI, checked production deployment, owner-authorized real TEST, and direct/relay/Sandbox checks remain four distinct evidence layers; a green CI never closes real acceptance.

Authoritative index: 32 coarse units, 16 MERGED, 7 IN_PROGRESS, 8 APPROVED, 1 ON_REQUEST; 15 approved unfinished parent units, not 15 fine-grained PR slices. Fifteen real release-dependent acceptance rows now PENDING, including four new H-4 obligations; preserve their required source pins, prerequisites and explicit refusal gates. Live branch last confirmed at 0b17dd5f4334790f0830265f479766e61dc29b0d and production READY before this session, hence independent owner-scope migration/TEST acceptance cannot be assumed on new main. Follow existing approved order in repository instructions; when release or external TEST credentials are unavailable, finish independent eligible work rather than defer all work. Never bypass owner-only setup, live promotion, review/CI, service-owned credentials or $0 spend policy.

## H-4 owner-only immediate Hub pass narrowing — PR #191 source proposal

From merged #190 (10a900ff80e2538cb8f499f907236ee672fd2760), implement immutable one-way server allowlist reduction on a live Hub pass and authenticated metadata readback. PostgreSQL must commit both reduction and nonsecret audit in one statement; stale actor and prior encrypted RTC page handles are rechecked against current SQL grants. The new HUB-H4-OWNER-NARROW queue row retains real hosted owner authorization, 010 migration, exact deployment and independent two-service RTC TEST proof as PENDING. All 13 prior acceptance rows are preserved and no manual release, provider permissions, money-out or production activation occurs.

## H-4 owner-confirmed OAuth RTC server subset — PR #190 source proposal

Following merged #189 (099ddba2fec173c2598ad5a2448c051812c6236e), H-4 now continues through OAuth authorization-code and refresh-session narrowing while retaining independent H-2 verified read_only service grants, owner verification and persistent SQL family scope parity. Source/SQL fixtures are not live acceptance. Queue receives HUB-H4-OAUTH-SELECTION with exact feature revision and new 011 migration gate; previous twelve obligations remain PENDING. No manual release, production secret, provider mutation or spending authorized.

## H-4 explicit server scope for owner-issued Hub TEST passes — PR #189 source proposal

Main starting revision c8d0fee389ebca0cbc5227a35e0ee421d7d921c1 after fully checked and merged #188. H-4 adds a verified-owner server selection enforced independently through grant staging, SQL target listing and active dispatch; existing caller-specific sealed RTC grants remain mandatory and read_only. A new additive SQL 010 is explicitly required for new scoped issuance, and real hosted acceptance is queued as HUB-H4-SERVER-SELECTION with exact feature-source revision. H-3 remains source IN_PROGRESS and its 11 pending real acceptance tasks stay pending; no credentials, provider writes, owner approvals, releases or spending changes. CI and integration tests must pass exact PR head before this source claim is merged.

## L-1 guarded local MCP commands — PR #188 source proposal

Independent approved L-1 work after PR #187: implement a bounded owner-opted-in local read-command door without arbitrary process execution, with explicit confirmation for non-default commands. Real-filesystem/MCP regression tests cover opt-in, traversal, symlink escape, byte/output bounds, confirmation and injection denial. Source/CI proof only until exact-head jobs pass; no provider calls, owner credentials, manual release or hosted production writes. L-1 remains IN_PROGRESS and general arbitrary-shell security is not represented as complete.

## Focused roadmap-throughput averages and remaining-work measurement — source PR #187

Owner-directed planning averages: 400–800 changed production-code lines
and 2–5 fully completed, existing-card-backed slices per substantive PR,
calculated from recent merged implementation PRs. Never pad, split
coherent outcomes, group unrelated risks, or weaken required CI to hit
a numeric target; isolated corrective changes are legitimate.

The existing read-only `npm run session:status` now counts coarse
authoritative indexed roadmap units by batch/status, independently of
the existing release-acceptance queue. Current baseline from the index:
32 tracked units; 16 MERGED, 6 IN_PROGRESS, 9 APPROVED, 1 ON_REQUEST,
so 15 approved unfinished units (the on-request unit excluded). These
units are NOT finer-grained PR implementation slices, and MERGED source
is not genuine hosted acceptance; pending provider/RTC tests stay open.
The owner's one-session request for five sizeable PRs remains in the
permanent handoff; it does not become a standing per-session quota.
No roadmap card, grant, credential, deployed acceptance or release
status was changed by this measurement enhancement.

## October 14 source-accurate acceptance readiness pins — correction

The new H-3 schema and bounded-batch acceptance rows must require their
**implementation source** revisions, not the previous main baseline.
HUB-H3-SCHEMAS now requires PR #184 exact source head; HUB-H3-BATCH-DEADLINE
requires PR #185 exact source head. Optional read-only `introducedFile`
markers make `session:status` fail closed with VERIFY_SOURCE_PIN if the
pinned revision does not actually contain the feature's introduced file.
Unknown/shallow local Git history similarly refuses to declare deployment
eligibility. The source marker check never treats READY state, standard
provider connectors or CI as actual authenticated RTC acceptance. No
provider network, permission, spending or scheduled release behavior changes.

## H-3 end-to-end RTC TEST read-only batch deadline — source proposal

One Hub batch must not continue dispatching a sequence of up to ten 5-second
provider POSTs after its 20-second execution budget expires. The same absolute
Hub deadline now follows each sequential call into independently scoped
preflight metadata GET and finally into a one-shot provider POST. TLS/DNS
socket-pinned transports can use bounded per-request timeouts no greater
than the original five seconds and no longer than the batch remainder.
Deadline exhaustion before dispatch refuses the call; if an already
acknowledged durable audit attempt expires, a matching unavailable outcome
is recorded *without* contacting the provider. Unknown POST outcome stays
unknown and is never retried. Suffix calls remain explicit denied results
with `incomplete:true`, preserving compact fixed MCP and HTTPS parity.

Source-only synthetic regression coverage includes deadline loss during
metadata, grant recheck and durable audit; one-shot timeout propagation
through both pinned HTTPS GET and POST; batch suffix stopping, existing
standalone 5-second behavior, no credentials and no write permissions.
Real hosted TEST read timing and independent provider audits require
checked deployment and approved passes: HUB-H3-BATCH-DEADLINE PENDING.

## H-3 separately scoped, short-lived on-demand read schema cache — new source PR

RTC schema descriptions can be reused for 15 seconds only for the same
verified service/owner/caller/grant/endpoint/tool context. Concurrent
DESCRIBE requests for that exact identity share one pinned GET, while
each caller independently rechecks its current grant afterward. Invalid,
oversized, write-capable, foreign-area, failed and unsafe schemas are not
cached or disclosed. One 32-entry/192-KiB memory limit prevents unbounded
metadata buildup; no network destinations or credentials are added.

**Every actual provider tool POST still fetches its own live readOnlyHint
metadata and performs durable audit before dispatch.** The cache is never
execution authorization. Native MCP and authenticated HTTPS describe use
one shared guarded path. Tests cover freshness, isolated concurrent hits,
expiry, 32-entry eviction, denial/rotation, active-grant rechecks, POST
metadata drift, and redaction. No deployment or authenticated provider
acceptance is claimed. HUB-H3-SCHEMAS is PENDING.

## H-3 fleet-wide complete RTC catalogue paging and scoped metadata cache — source awaiting reviewed PR
Broad read_only TEST search can now continue past both the next authorized
service and the individual RTC provider's next catalogue page in one
Hub search flow. Each turn contacts at most three scoped providers and takes
one tool per provider so page-budget overflow does not silently skip tools.
An AES-256-GCM sealed five-minute fleet token carries at most three upstream
continuations, a bounded service index and per-service page counts; tokens
are bound to the exact owner, caller, query, grant roster, verified origin,
areas and service identity. The existing single-provider sealed continuation
and legacy signed between-service token remain supported.
An in-memory, 15-second, 64-entry/128-KiB cache reduces repeated authorized
RTC metadata GETs. Keys are one-way keyed digests binding owner, caller,
grant, origin, verification, area, query and typed upstream page selector.
The Hub still resolves the actual active caller grant both before and after
each metadata lookup. Cache never covers executable schema validation,
provider POST, stored results, or authorization. All provider services remain
standalone, with no new network destinations, write methods or spending.
Synthetic tests exercise 5 and 100 services, all three independently observed
RTC pagination shapes, denial/replay, grant/origin rotation, outage isolation,
MCP/HTTPS parity, cache expiry/bounds/rotation and no secret disclosure.
Production deployment and genuine multi-provider TEST access/revocation
remain **PENDING** as HUB-H3-FLEET-PAGES, not verified by source or CI.

## H-3 encrypted selected-provider RTC catalogue pages — source branch
A selected granted read_only TEST service can resume its own upstream
GET /api/tools `next` through MCP or authenticated HTTPS, rather than
silently losing additional provider tools. Opaque provider continuations
are AES-GCM sealed and tied to exact caller/grant/revision scope; forged,
expired or rotated tokens are refused before any provider network call.
Broad three-provider search and bounded service cursors remain unchanged.
Reviewed upstream provider code identifies numeric-offset RTC listing for
Stripe and decimal-page RTC listing for Workspace; Hub now emits only that
observed selector style under pinned allowlisted GET. Source and synthetic
tests are not release or real-provider evidence.
Production RTC cursor compatibility, authenticated browse and revocation
readbacks are queued as HUB-H3-UPSTREAM-PAGES; no release/spending requested.

## October 14 outcome-sized agent-session policy — PR #181 source
The owner replaced fixed five-PR session quotas and divisible-by-five PR-number
boundaries with complete approved roadmap slices grouped into compatible,
reviewable large PRs. Roughly 500–800 meaningful production lines plus tests
is advisory for suitable coherent work, never a minimum, quota or reason to
pad features; risk, quality gates and integration decide packaging. Every
merged PR is a durable context-recovery checkpoint. The read-only
`session:status` CLI now reports the observed PR only informationally.
This change does not advance H-3 provider acceptance, release source to
production, activate RTC grants or relax any owner/security/spending gate.

## October 14 H-3 owner-confirmed temporary TEST service retirement — PR #180 (source proposal)
A verified owner may retire one exact Hub RTC registry service and revoke
its remaining TEST grants atomically after entering a typed confirmation.
The operation does not delete provider records, change the standalone
service, call upstream APIs or loosen bearer scopes. Disposal/rollback
proof uses a real isolated Postgres schema plus owner-route refusal tests.
Production TEST activation and D-4 external cleanup evidence remain OPEN.

## October 14 H-3 grant/endpoint-bound federation cursors — PR #179 (source proposal)
A signed Hub search/namespace continuation now fails closed when the
actual caller's active grant changes or the destination/verification rotates,
even when public service names and areas remain the same. A disposable
Postgres selector test confirms private identity pins; synthetic native
cursor tests ensure no provider call on stale replay. No secrets returned;
deployed two-service and revocation acceptance remain OPEN.

## October 14 H-3 owner-authenticated setup readiness — PR #178 (source proposal)
The owner can inspect the exact H-3 schema, encryption-key and active TEST
grant prerequisites from a no-store, independently password-verified mobile
browser form without revealing provider credentials or activating routing.
GET is metadata-free; unauthorized POST performs no registry inspection.
Unit tests cover owner auth, locked state, unavailable schema and sanitized
failures. Deployed TEST identity/read/denial/revocation remain OPEN.

## October 14 H-3 bounded encrypted handle expiry cleanup — PR #177 (source proposal)
Dedicated RTC read-result storage now prunes at most 100 expired encrypted
handle rows during a new stored result, without affecting unexpired RTC pages
or the independent H-1 result table. Real throwaway PostgreSQL tests prove
expiry-only pruning and bounded continuation; production DB cleanup has not
been executed and actual provider TEST acceptance remains OPEN.

## October 14 H-3 bounded sequential multi-provider batch — PR #176 (source proposal)
Hub multi-read batches now have explicit per-request time/output budgets,
preserve successfully completed read entries, report the unactioned remainder
as partial, and stop dispatch rather than overrun hosted function time or
silently truncate a response. Synthetic native/HTTPS tests are source proof
only; authenticated two-service TEST, revocation and D-4 routes stay OPEN.

## October 14 H-3 in-flight read grant revocation — PR #175 (source proposal)
Hub now withholds completed upstream RTC read results if the caller's grant
was revoked or replaced while the provider POST was in flight, after durable
attempt/outcome audit. No automatic retry, no key disclosure or success on a
failed final grant check; the final validation also gates encrypted handles.
Real TEST issuer revocation, native/HTTPS readback and D-4 routes remain OPEN.

## October 14 H-3 metadata reauthorization — PR #174 (source proposal)
Authenticated provider-search and on-demand-schema results are now rechecked
against the original caller-specific, current active grant immediately after
the remote metadata GET. Revocation or replacement during the remote request
must not disclose the stale metadata. Separate actual deployed TEST read,
provider-denial, schema readback, revocation, relay and Sandbox evidence remain
OPEN; no service was activated by this source change.

## October 14 fleet and hosted database independent readbacks
The checked #169 GitHub Actions public-observe job (run 38590859362,
readback at 2026-10-14 15:37:53 UTC, original HEAD
`6b06a708b6609f65358a05213115893faf0d9ec5`)
made real unauthenticated GET /api/contract requests to the five
tracked production DNS origins. Google Workspace answered HTTP 200,
valid RTC 1 metadata with `workspace_` prefix but no confirmed
TEST auth; GitHub answered HTTP 200 with RTC 0 (not RTC 1);
Stripe, Vercel and Neon each answered HTTP 401 access-protected.
All direct authenticated reads, private relay, Sandbox and same-pass
revocation remain UNVERIFIED, not passed by public GET or the standard
connectors. No credentials were used in this probe.
Separate read-only Neon table inventory of the existing
`robinsons-toolkit-relay` project on Oct 14 found 11 existing Hub
foundation/relay tables but no `hub_servers`,
`hub_server_grants`, `hub_rtc_read_audit`, or
`hub_rtc_result_handles`. Therefore hosted additive migrations
004-006, 008, 009 and actual two-service RTC grant routing remain
OPEN. No hosted SQL changes or manual deployments were performed.
Trust the independently observed Vercel READY production deployment on
`live=a26ff2fd81cab3500b1e1dab8332e2575a6d9592`
until new provider evidence supersedes it. Main has new source not yet
released; do not relabel source CI as provider acceptance.

## H-3 authorized catalogue browsing — PR #170 (pending review)
Agents can explore all grant-eligible RTC metadata through native
`hub_search_tools({query:''})` or authenticated HTTPS `GET /api/tools?q=`
and can browse one permitted service via `?server=stripe` without knowing
tool names. The unqualified `GET /api/tools` preserves its small fixed
Hub menu and incurs no provider requests. Every exposed upstream remains
narrowed to TEST read_only grant/areas with a maximum three selected
origins per request, 20 results, signed caller-bound resume cursor
and explicit partial/incomplete reporting. Synthetic tests cover full
100-service traversal, tampering/refusals and zero provider calls for
unqualified reads. Result-limit saturation reserves one representative per scanned provider
before local/extra tools and marks omitted metadata incomplete;
a targeted service browse can recover its bounded candidates.
Provider-specific next-page pagination and real
hosted TEST access are not asserted. Await checked live release and
actual provider acceptance: HUB-H3-BROWSE.

## H-3 fixed HTTPS broker parity — PR #169 (pending review)
Authenticated Hub HTTPS `POST /api/tools/{hub_broker}` now uses the same
grant-filtered native federation dispatcher for Hub health, tool search,
describe, call, batch and namespaces, rather than responding with stale
foundation-only stubs or rejecting valid RTC read calls. Direct,
`hub_call` and mixed-batch health all compute actual eligible target
metadata, including zero configured targets. The Hub's existing pass, TEST,
owner, grant, metadata readOnlyHint, audit-before-read, single-shot POST,
byte budgets, and denial controls remain. Synthetic handler tests cover
successful reads and guarded refusals. Actual hosted/provider acceptance
must wait for the normal checked live release: HUB-H3-HTTP-BROKERS queue.

## H-3 RTC prefix and 100-target route parity — PR #168 (awaiting merge/release)
The Hub now uses one canonical RTC owner parser across encrypted pinned metadata
discovery, schema lookup, read POST and federated longest-prefix routing. Already
delimited provider prefixes (for example Workspace's `workspace_`) are accepted
without double underscores; ambiguous/doubled separators and cross-service tool
calls are refused before credentials or provider requests. Scoped call and describe
can target all 100 eligible services, matching navigation and discovery's existing
100-service ceiling rather than silently dropping callers after service 50.
Adversarial fake-network tests cover both GET and POST, complete 100th-service
routing, audit-before-read and doubled-prefix denial. No new privilege, provider
mutation, production activation or upstream credentials. This is proposed source,
not installed on live: real TEST Workspace read/denial/revocation, hosted migrations
and verified deployment remain in HUB-H3-PREFIX acceptance queue.

## Workflow maintenance CI correction — PR #167

The consolidated guide supersedes old workflow headings. The owner-workflow regression now checks the same milestone, blocker re-entry, separate deployed/authenticated proof, permanent handoff and five-PR alignment requirements through the authoritative AGENTS pointer and session guide, with added explicit pre-merge/live-proof guard assertions. No runtime assertion or safety gate was weakened. Focused tests and normal check pass; exact-head CI remains required. ARCHITECTURE now acknowledges existing H-2/H-3 source modules while retaining unverified hosted/provider acceptance. The old reference API hosting was separately paused and future Git builds disabled under owner instruction; current Hub relay hosting was preserved.

### Workflow maintenance handoff — owner publication approved

New offline session utility: eight behavioral tests passed, including actual Git ancestry, partial releases, unknown/failed deployments, rollback, dependency gating, invalid queues, PR alignment and bounded output. All repository queues validate. Existing source/status evidence is preserved; no provider acceptance or release was performed. Owner explicitly approved publication on October 14; publish the reviewed maintenance branch, require exact-head CI/reviews, and merge only when those gates pass. No extra production release is authorized by this approval. Full broad application suites on the shared runner were interrupted after resource/time-limit failures; do not claim them passed. Existing exact-head remote CI/review gates must pass before any main merge.

## Release acceptance queue — workflow optimization 2026-10-14

Owner-authorized guidance/tooling maintenance: consolidated session procedure, focused
checks between meaningful edits, substantial capability grouping, and read-only queued
acceptance/PR-boundary report. This records source/tooling work, not a live/provider pass.
The queue below seeds existing outstanding obligations; reconcile exact scenarios and
already-proven evidence from the unchanged cards/ledger before running. Keep all prior
open obligations, original fixture ownership, approvals and deployment provenance.

<!-- release-acceptance:start -->
```json
[
  {
    "id": "HUB-D4",
    "priority": 1,
    "requiredRevision": "22b69eb14bcd54b86f5c00aa0567aed1e8f9d3c4",
    "task": "Complete remaining direct/relay/Sandbox routes, refusal, revocation and cleanup acceptance",
    "procedure": "docs/pr-cards/D-4.md",
    "gates": "Reviewed deployed service revisions; separately scoped service passes and owner-approved isolated runners",
    "dependsOn": [],
    "status": "PASSED",
    "lastEvidence": "2026-10-17: D-4 full original criteria passed for Workspace; separate local direct and GitHub-only encrypted relay original runner exit0/all5, same new pass revoked and denied via relay plus direct HTTP401, cleanup verified; original Sandbox/native proofs PR224/226 retained. docs/audits/2026-10-17-d4-final-route-acceptance.json"
  },
  {
    "id": "HUB-FLEET",
    "priority": 2,
    "requiredRevision": "22b69eb14bcd54b86f5c00aa0567aed1e8f9d3c4",
    "task": "Catch up actual hosted fleet observations and permitted authenticated reads",
    "procedure": "docs/SESSION-START.md",
    "gates": "Preserve exact revision pins and non-production RTC TEST restrictions; public manifest is not authenticated proof",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Checked GitHub runner public GET: Workspace RTC1 prefix workspace_ HTTP 200 unauthenticated; GitHub RTC0 HTTP 200; Stripe/Neon/Vercel protection HTTP 401. Custom Hub authenticated foundation health RTC0 and zero active upstreams. Genuine signed-in service reads still open."
  },
  {
    "id": "HUB-H3-PREFIX",
    "priority": 3,
    "requiredRevision": "2b430dbd5981cf51a191dd84415e11696e80f265",
    "task": "Verify Hub-mediated Workspace trailing-underscore RTC read, schema lookup, audit/readback and grant-revocation denial at the approved TEST origin; retain 100-service routing scale as synthetic until an actual large fleet exists",
    "procedure": "docs/pr-cards/H-3.md",
    "gates": "Checked live Hub revision, hosted 004-006/008/009 migrations, independently pinned RTC deployment and service-owned TEST read_only grants; no provider write",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Source #168 and successors deployed at exact Hub 0b17dd5f production READY. Hosted 004-006/008/009 migrations independently installed; zero staged/verified RTC grants or active services. Separate sensitive HUB_GRANTS_KEY now configured for next checked deployment; do not infer active runtime key. Actual Workspace TEST schema/read/denial/revoke open."
  },
  {
    "id": "HUB-H3-HTTP-BROKERS",
    "priority": 4,
    "requiredRevision": "c910f267cf077df7c14e98ae17b653c5263f956e",
    "task": "Prove native and Hub-pass HTTPS broker parity under the same independently authenticated TEST grant: search, schema, scoped call, sequential batch, health and denial/readback",
    "procedure": "docs/pr-cards/H-3.md",
    "gates": "Checked Hub live deployment; additive hosted grants/audit migration; independent Hub TEST pass and active verified RTC upstream grant; no provider writes",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Deployed Hub H-3 native and HTTPS code at READY 0b17dd5f and independently read back hosted schema; no actual independently pinned upstream TEST credentials, grant, authenticated two-service read, native/HTTPS parity or revocation accepted."
  },
  {
    "id": "HUB-H3-BROWSE",
    "priority": 5,
    "requiredRevision": "69dcd0738dee3eb082c2eb0f9597d8899a1157b1",
    "task": "Verify zero-keyword RTC catalogue browsing through one actual Hub TEST connection, including scoped HTTP/default listings, service selection, signed cursor, denial and upstream partial-page disclosure",
    "procedure": "docs/pr-cards/H-3.md",
    "gates": "Source released to READY Hub deployment with approved hosted registry/audit schema; sealed TEST read_only service grant verified; do not infer full provider pagination",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Source #170 deployed at Hub READY 0b17dd5f, database migrations now installed, but catalog browse requires approved verified owner/TEST grant setup; provider next-page completeness and signed-in readback remain open."
  },
  {
    "id": "HUB-H3-OWNER",
    "priority": 6,
    "requiredRevision": "cdf00c81bf65a36f90d00e623c41fd4f1a2b21c8",
    "task": "At checked deployed source, verify genuine owner-authenticated mobile readiness form, counts, privacy/denials and distinct two-service TEST preflight without exposing passwords or granting provider access",
    "procedure": "docs/pr-cards/H-3.md",
    "gates": "Reviewed READY live revision including owner readiness source; independently verified owner login, no-store page, installed SQL and secure configuration; do not submit credentials through PR/chat",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: #178 merged and exact-head source CI passed. Owner readiness has not yet appeared in verified READY release or undergone protected real owner-form acceptance; no live owner password was used."
  },
  {
    "id": "HUB-H3-RETIRE",
    "priority": 7,
    "requiredRevision": "a78c994fe4ff8bac5ec8c623a00d470be196880b",
    "task": "Verify owner-confirmed exact TEST service retirement, atomic linked-grant revocation, independent readback and restricted-fixture cleanup in an authorized isolated environment",
    "procedure": "docs/pr-cards/H-3.md",
    "gates": "Checked READY deployment with H-3 registry/grant schema, owner verification and exact typed RETIRE approval for independently authorized disposable TEST fixture only; no production provider data deletion",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Source and isolated PostgreSQL/owner-route tests proposed in PR #180; no authorized real staged fixture or hosted retirement has been executed."
  },
  {
    "id": "HUB-H3-UPSTREAM-PAGES",
    "priority": 8,
    "requiredRevision": "66edca0d943e80b64e27cee4c22730ddf07e5b25",
    "task": "Independently verify a checked Hub deployment follows a real scoped RTC provider next-page token through native MCP and HTTPS selected-service browse; demonstrate two or more distinct results, denied forged/expired/rotated grant cursors and standalone provider readback",
    "procedure": "docs/pr-cards/H-3.md",
    "gates": "Reviewed released Hub source at least required revision; exact RTC1 provider origin and sealed independently issued TEST read_only grant, protected owner and caller identities; no provider writes or live execution",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Source-only selected-service upstream cursor transport and encrypted Hub continuation added on implementation branch; no new READY production release, staged RTC grants, genuine provider paging, denials or same-pass revocation verified."
  },
  {
    "id": "HUB-H3-FLEET-PAGES",
    "priority": 9,
    "requiredRevision": "86a8d98fd1ab7240a99f05285fc8d33dce9301a5",
    "task": "Prove one genuine authorized cross-service Hub search traverses upstream RTC provider page 2 and then all remaining scoped services through native MCP and HTTPS; verify bounded no-duplicate results, denied stale/forged cursor, same-pass grant revocation, audit/readback and standalone service independence",
    "procedure": "docs/pr-cards/H-3.md",
    "gates": "Checked READY deployment at least required source revision; two distinct independently verified RTC1 TEST origins with separately issued owner/scoped read_only grants; caller connection, no live writes, safe fixture cleanup",
    "dependsOn": [
      "HUB-H3-UPSTREAM-PAGES"
    ],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Source and synthetic 5/100-service/HTTP/MCP/cache/revocation tests assembled in one H-3 feature PR; no newly verified ready deployment, provider-paged two-service acceptance, same-pass revocation or real fixture cleanup."
  },
  {
    "id": "HUB-H3-SCHEMAS",
    "priority": 10,
    "requiredRevision": "b530feef19f3df9048ae72cd8b86970d51c94905",
    "task": "Verify a checked Hub production deployment uses only independently narrowed authenticated RTC1 TEST schema GETs, on-demand cached DESCRIBE parity through native/HTTP, reauthorization and provider metadata drift/write denial, with direct provider readback",
    "procedure": "docs/pr-cards/H-3.md",
    "gates": "New merged implementation checked READY; real isolated two-service scoped TEST passes; no LIVE provider write, grant rotation and standalone acceptance separate",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Read-only, concurrent, caller/grant/verified-origin-bound 15s describe cache source/fixtures on PR branch; deployed custom RTC schema and revocation evidence outstanding. Corrected required revision to exact source feature head #184, not preceding base; source file pin must exist at that revision.",
    "introducedFile": "packages/hub/src/schema-cache.js"
  },
  {
    "id": "HUB-H3-BATCH-DEADLINE",
    "priority": 11,
    "requiredRevision": "24b65fcdd5906d38a78b9a0960607f1e6dc1f252",
    "task": "Verify a checked deployed Hub uses bounded RTC TEST batch schema GET and one-shot read POST timeouts, stops suffix calls at 20 seconds, preserves durable audits, reports uncertainty/no retries and honors grant revocation through native MCP and HTTPS",
    "procedure": "docs/pr-cards/H-3.md",
    "gates": "Verified READY deployment containing source and independently owner-approved TEST/read_only grants; no LIVE money/write tests or unapproved fixtures",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Source adds batch-scoped deadline propagation into pinned metadata GET and non-retrying provider POST with synthetic timing, audit, MCP/HTTPS and denial fixtures; no genuine deployed custom RTC proof. Corrected required revision to exact source feature head #185, not preceding base; source file pin must exist at that revision.",
    "introducedFile": "packages/hub/test/batch-deadline.test.js"
  },
  {
    "id": "HUB-H4-SERVER-SELECTION",
    "priority": 12,
    "requiredRevision": "0d313eea1f4f302a755f67c33161f7cf59135365",
    "introducedFile": "packages/hub/migrations/010-hub-pass-servers.sql",
    "task": "Verify hosted additive migration 010 and genuine owner-selected Hub TEST pass cannot search, describe, call or read result from an unselected verified RTC service, including stale actor, stage denial and same-pass revocation",
    "procedure": "docs/pr-cards/H-4.md",
    "gates": "Independently checked Hub live READY source and hosted 010; owner-confirmed scoped Hub TEST pass and two independently attested active read_only upstream services; no LIVE, write or money permissions",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: H-4 owner-selected server restriction is source-only in PR #189; disposable SQL/fixture CI and release need exact-head verification. Hosted 010, genuine owner pass, provider TEST and cross-door refusal are unverified."
  },
  {
    "id": "HUB-H4-OAUTH-SELECTION",
    "priority": 13,
    "requiredRevision": "87059841d9dc12ac7838c25f644fbdef7820b8fa",
    "introducedFile": "packages/hub/migrations/011-hub-oauth-server-scopes.sql",
    "task": "On checked Hub READY with additive SQL 011, prove owner-confirmed OAuth PKCE selected RTC service allowlist persists through refresh rotation; genuine selected and unselected TEST routes, family tamper/refusal, and explicit revocation deny old access",
    "procedure": "docs/pr-cards/H-4.md",
    "gates": "Independently verified owner OAuth consent and Hub deployment revision, migrations 010/011 applied, two separately attested RTC1 service-owned read_only TEST passes; real authenticated audit/readback, no LIVE/write",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: #190 H-4 OAuth owner-consent, token family inheritance and H-2 SQL source/fixture tests proposed; no installed hosted 011, actual owner consent or real provider TEST credential proof."
  },
  {
    "id": "HUB-H4-OWNER-NARROW",
    "priority": 14,
    "requiredRevision": "e8f12191c2ce64401e834c0269a6ed0aad7ac57b",
    "task": "Verify password-gated owner Hub pass scope readback, atomic in-place server reduction, immutable audit row, stale actor and prior encrypted RTC result-handle denial on real hosted TEST after 010",
    "procedure": "docs/pr-cards/H-4.md",
    "gates": "Independently checked deployed Hub source and migration 010; exact owner-approved TEST caller and two independently verified read_only RTC upstream grants; audit/readback with real result handle; no provider mutation",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: #191 owner-only atomic scope reduction, source/real disposable SQL and synthetic RTC result-page tests proposed; no actual hosted owner readback or prior real TEST result handle."
  },
  {
    "id": "HUB-H4-AREA-CEILINGS",
    "priority": 15,
    "requiredRevision": "88f11d2f0680c0a3a1eb5627027ac7015580316e",
    "introducedFile": "packages/hub/migrations/012-hub-grant-area-ceilings.sql",
    "task": "Verify hosted additive SQL 012, independently authenticated owner one-way per-grant TEST area restriction, durable redacted policy audit, an authorized area read, forbidden removed-area schema/call/batch, and refusal of old encrypted RTC result handle on both native MCP and HTTPS",
    "procedure": "docs/pr-cards/H-4.md",
    "gates": "Exact checked deployed Hub READY source and installed SQL 010/011/012; owner-approved scoped Hub and independent service-owned RTC TEST/read_only passes, two genuinely attested services and durable provider audit readback; never write or spend",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Source PR #192 owner-only area ceiling, unchanged encrypted upstream grant, atomic audit and result deletion with disposable PostgreSQL integration are not deployment or external RTC acceptance."
  },
  {
    "id": "HUB-H4-OWNER-OAUTH-LIFECYCLE",
    "priority": 16,
    "requiredRevision": "c7b0a6d5e658516162d1201974c75c5c99abfb6f",
    "introducedFile": "packages/hub/migrations/013-hub-owner-oauth-audit.sql",
    "task": "Verify owner-only OAuth family metadata, exact family revocation, durable redacted family audit, refresh/access denial and old encrypted RTC handle invalidation with real hosted TEST",
    "procedure": "docs/pr-cards/H-4.md",
    "gates": "Checked READY deployment containing migration 013 and prior 010/011/012; independently authenticated owner and genuine service-issued TEST/read_only caller with active RTC grant; inspect durable audit and provider read/no-write",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: H-4 owner OAuth family lifecycle source, synthetic HTTP and disposable SQL evidence only; no hosted owner or real RTC TEST readback."
  },
  {
    "id": "HUB-H4-OAUTH-FAMILY-NARROW",
    "priority": 17,
    "requiredRevision": "59bb7466e501f9232317adc257358bd0fe61e80a",
    "introducedFile": "packages/hub/migrations/014-hub-oauth-family-scope-audit.sql",
    "task": "Verify authenticated owner one-way family server reduction, all rotated session scopes, durable nonsecret audit, no removed-service native/HTTP read and prior encrypted RTC result-page refusal",
    "procedure": "docs/pr-cards/H-4.md",
    "gates": "Checked READY deployment with migrations 010/011/013/014, independently verified owner and service-issued TEST/read_only upstream grants, genuine two-service RTC read and denial proof; no write or LIVE",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: local HTTP/isolated PostgreSQL H-4 family narrowing and concurrency checks are not deployed owner or real provider TEST evidence."
  },
  {
    "id": "HUB-H4-CALLER-AREAS",
    "priority": 18,
    "requiredRevision": "ffb468f3f13c624404ef41ffceda76f9a351516b",
    "introducedFile": "packages/hub/migrations/015-hub-caller-service-area-policy.sql",
    "task": "Verify verified-owner per-service Hub pass and OAuth family area restrictions, current-SQL discovery/schema/call/batch denial, refresh inheritance, owner readback/audit, old encrypted RTC result refusal, independently authenticated two-service TEST on native MCP and HTTPS",
    "procedure": "docs/pr-cards/H-4.md",
    "gates": "Reviewed READY Hub deployment including SQL 015 and prior migrations; genuine independent owner login, service-issued TEST/read_only credentials, exact provider revisions and no-write provider audit; repeat direct/relay/Sandbox separately",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: Source integration and throwaway PostgreSQL tests only; new per-service caller policy is not released or owner-authenticated against genuine provider TEST."
  },
  {
    "id": "HUB-H4-ACTIVE-GRANT-RENEWAL",
    "priority": 19,
    "requiredRevision": "a3b8cd84c90ba96d7bed0994e0ddc796670d6729",
    "introducedFile": "packages/hub/migrations/016-hub-grant-renewal.sql",
    "task": "Verify owner-only staging of a fresh independent TEST credential on an active service, pinned RTC identity refusal, atomic verified replacement without a read outage, old encrypted result handle invalidation, auditable cancellation and new-caller enrollment in real hosted two-service TEST",
    "procedure": "docs/pr-cards/H-4.md",
    "gates": "Checked production READY Hub source including SQL 016, exact owner credential verification, independent TEST/read_only scoped service pass (no owner credential in chat), no provider writes or LIVE, separately verified direct/relay/Sandbox",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "2026-10-14: proposed local source/test only; no hosted migration, renewal or genuine RTC TEST receipt."
  },
  {
    "id": "HUB-H4-PROFILE-POLICY",
    "priority": 20,
    "requiredRevision": "a2e2b91fccbab94a0e64109642191dd835792473",
    "introducedFile": "packages/hub/migrations/017-hub-caller-service-profile-policy.sql",
    "task": "Verify checked hosted TEST owner service-profile ceilings on Hub passes and OAuth refresh families, immediate disabled-service native/HTTP/batch/result denials and new-refresh inheritance against independently attested read_only provider grants",
    "procedure": "docs/pr-cards/H-4.md",
    "gates": "Exact READY live Hub deployment containing SQL 017, independent verified owner and two distinct service-owned RTC TEST/read_only grants, durable audit and negative no-write provider evidence; direct/relay/Sandbox separately",
    "dependsOn": [],
    "status": "PENDING",
    "lastEvidence": "Source H-4 profile policy, owner UI, initial PKCE/HUB-pass selection and disposable PostgreSQL tests proposed; migration 017, independent provider TEST, actual owner readback, direct/relay/Sandbox acceptance PENDING."
  },
  {
    "id": "HUB-H3-LIVE-RESULT-HTTP",
    "priority": 2,
    "requiredRevision": "e249af5cd3dc0576b786cf3e5dc7cc06c434139d",
    "introducedFile": "packages/hub/src/results-http.js",
    "task": "Normal owner-scoped LIVE RTC large-read result can be paged through actual HTTP with the same current caller and original independently issued provider grant; wrong caller, revoked/replaced grant and expiry deny without replay.",
    "procedure": "docs/pr-cards/H-3.md October19 LIVE HTTP result acceptance; docs/OWNER-GUIDE.md Retrieve large RTC read results",
    "gates": "Exact checked source on independently READY Hub; approved hosted schema/keys; normal generic discovery and owner authorization, new separately scoped LIVE read-only Hub/provider grants and exact harmless owned read. Do not reuse direct-only Workspace pass or original rotating owner credentials; no provider write or spend.",
    "dependsOn": [],
    "status": "PENDING",
    "subsections": [
      "H-3"
    ],
    "lastEvidence": "Source implements shared actual HTTP RTC TEST/LIVE retrieval with original grant revalidation, retaining legacy H-1 TEST restrictions. Local check,938 unit tests and20 focused route tests passed. Disposable SQL and complete exact-head CI required before merge; no real normal hosted connection, large provider read, same-pass denial/revocation or release performed."
  }
]
```
<!-- release-acceptance:end -->

<!-- Current repair also records no-change daily receipts: backups cannot publish later same-day development after a successful no-op. -->
## October 14 owner-requested daily release recovery repair — current

Owner request on October 14: investigate and repair missed daily releases across the MCP repositories and Appliance Desk, including the quoted owner-run checked recovery. This supersedes the prior scheduled-only/no-new-trigger restriction for missed-event recovery only. Primary 00:01 Denver remains; retries are 00:17, 01:17 and 05:37 Denver plus 12:43 UTC. Explicit recovery defaults OFF and requires both the original actor and the triggering actor to be christcr2012, main, true recovery input and elapsed midnight. Every path retains successful exact-main CI, ancestry, atomic once-per-Denver-day receipt and independent readback. No production-provider activation, spending, force push or preview build is authorized.

Local release safety tests pass. Merge requires exact-head application CI and review resolution. Source repair is separate from observed schedule execution and Vercel READY/alias proof; inspect actual daily run and receipt, do not equate main/live drift after a release with failure. These infrastructure PRs do not replace the existing substantive implementation batch.

## H-3 large-fleet namespace navigation — next source PR

The fixed-menu `hub_namespaces` native Hub operation now uses a bounded,
optional `limit` and short-lived caller/roster-signed `cursor` for
on-demand paged navigation through up to 100 authorized RTC namespaces.
Default small fleets retain the original Hub+RTC response. Every later
page avoids repeating the Hub entry; every service is returned exactly
once, without contacting external provider tools or fetching schemas.
`hub_health` now reports the same bounded 100-service eligible count.
Revoked/changed rosters and changed callers fail closed. Synthetic tests
cover full 2/5/12/50/100 roster traversal, a limit of one, correct
health counts, denial and zero provider requests. Large real fleets
and hosted migrations/provider acceptance remain OPEN. This is proposed
source, not a deployed or accepted live claim.

## H-3 bounded RTC discovery continuation and measured scale — proposed

Native `hub_search_tools` and GET `/api/tools?q=...` now accept an
opaque HMAC-authenticated, five-minute search cursor bound to caller,
query, profile/mode and the current authorized service roster. No
unauthorized grant/provider can be reached by replaying or modifying it.
The broker queries at most three independent RTC origins per page and
can resume beyond the previous hard first-three ceiling through 100
bounded eligible service records. Lower result limits resume after
the exact number of inspected services, without skipping or duplicating
providers. Metadata responses stay under a bounded UTF-8 budget; partial
truncation/failures are explicitly marked as incomplete, not silently
omitted. Synthetic CI measures elapsed milliseconds and RSS delta at
2/5/12/50/100 service deployments, with 10,000 advertised aggregate
tools at the largest level, without eager schema loads. Synthetic
measurements do not prove actual provider network latency or standalone
MCP acceptance. Hosted acceptance remains OPEN.

Independent read-only Neon table inventory on 2026-10-13 found Hub
foundation tables, but no `hub_servers`, `hub_server_grants`,
`hub_rtc_read_audit` or `hub_rtc_result_handles` in public schema.
Thus hosted migrations 004–006, 008 and proposed 009 are not proven
applied and real federation is not currently runnable. Deployment READY
and synthetic database CI remain distinct. No production schema changes
were made during this observation.

## H-3 grant-scoped encrypted RTC pagination — next implementation PR

Forwarded RTC harmless reads exceeding the ~8 KiB inline envelope can now
use a one-hour, AES-GCM encrypted, maximum 64 KiB opaque result handle.
Pages are UTF-8 byte chunks encoded in base64url; they are not silent JSON
slices. The new RTC result store remains separate from existing H-1 results
and never persists raw handles, credentials or plaintext. Readback requires
the exact owner/caller and re-resolution of the same active grant/server on
every page, so revocation and grant replacement invalidate stored results.
Native MCP uses `hub_call` with `hub_result_read`; Hub pass HTTPS readers
use `/api/results/{handle}?page=N`. A larger result is explicitly refused.
Additive migration 009 and synthetic SQL/MCP tests are part of proposed
source, not yet installed hosted schema or real two-service acceptance.
Avoid deploying before checked daily release; hosted 008 and 009 migration,
provider-scope and revocation tests, large-result host readbacks and
measured scale remain OPEN.

## H-3 direct HTTPS RTC federation — implementation PR in review

The existing `/api/tools` GET search/schema and POST call/batch HTTP doors now
share H-3's native MCP upstream selection, active exact-caller TEST read_only
grant re-resolution, metadata safety checks, durable attempt/outcome audit,
single-shot DNS-pinned HTTPS POST and independent batch refusal. Empty Hub
catalogue and Hub-owned calls retain their prior backward-compatible HTTP
shapes. Handler-level tests use a synthetic independently scoped RTC service
and assert positive read, audit linkage, no-retry, denied writes/live actors,
absent grants, HTTP status and bounded results. HTTPS source parity is a
proposed change, not yet merged, deployed or independently accepted. Actual
provider readbacks, migration 008 on hosted Postgres, 2-service Hub identity,
revocation, RTC1 certification, handles/pagination and measured scale remain
OPEN. No provider mutation, public access widening or manual release.

## H-3 guarded upstream RTC read execution — PR #160 proposed

Native Hub `hub_call` and sequential read-only `hub_batch` now have
source-level TEST read routing through active, exact caller-specific
upstream grant, prefix, on-demand harmless RTC metadata and socket-pinned
HTTPS one-shot POST. No automatic retry of ambiguous POST outcomes.
Durable additive 008 PostgreSQL attempt/outcome audit rows correlate
OAuth/pass caller, owner, grant, service, canonical tool, upstream log
ID and one operation correlation. Oversize inline result is explicitly
refused, not truncated. Synthetic HTTP and disposable SQL tests verify
guards, refusal, audit and partial failures. Source-merged != deployed:
hosted 008 migration, real RTC deployment/identity pins, two-service
Hub-mediated read and denial/revocation, HTTP parity, handles/pagination
and RTC1 conformance remain open. No live provider mutation or release.

## H-3 native MCP selective RTC discovery — PR #159 proposed

The Hub's fixed MCP menu now routes `hub_search_tools`,
`hub_describe_tool`, `hub_namespaces` and `hub_health` to the
metadata-only RTC path. At most three eligible active read_only TEST
service grants are queried per search, with scoped database selection,
exact grant re-resolution, canonical tool prefix and on-demand schema
retrieval, bounded content, independent partial-outage reporting and no
secret disclosure. Health is `discovery_only`, not provider call readiness.
Synthetic orchestration tests cover success, refusal, partial outage and
no unintended execution. Live provider dispatch, HTTP parity, audit,
handles/pagination, RTC1/full deployed two-service acceptance remain OPEN.

## H-3 pinned RTC tool discovery and on-demand schema — PR #158 proposed

The existing socket-pinned, hostname-verified HTTPS TEST transport now has
a narrowly allowlisted GET-only read of scoped RTC search and exact schema
endpoints; code verifies canonical prefix, area, read_only profile, readOnly
metadata, bounded bytes and selected result counts. Synthetic two-service
transport tests demonstrate refusal/SSRF restrictions. This is H-3 source
preparation, not deployed/Hub-connected federation or external acceptance.
No upstream credential, provider mutation, live release or spending.

## H-2 full TEST developer narrowing and selected targets — PR #157 proposed

One connected full-profile TEST developer can use a **separately sealed,
verified, read_only upstream RTC pass** without being misclassified as a
read_only Hub login. Exact actor, owner, service, prefix, mode, expiry,
verification and revocation remain enforced on resolution. Selective active
target metadata has a 50-entry cap and contains no pass. SQL tests use
disposable database schema and synthetic scoped inspector only. This source
progress does not activate runtime federation or certify migrations on the
hosted DB, authentic deployment identity, provider routing or two-service
read/denial/revocation acceptance. No live deployment is requested.

## Browser form parsing recovery — 2026-10-13

The released owner setup link still returned HTTP 200 with the expected form, and no owner credential was saved. Local reproduction found that Node querystring-parsed browser forms have a null prototype, which the owner and OAuth parsers incorrectly rejected. Accept that safe dictionary shape while rejecting inherited prototypes, duplicate arrays and oversized values. A real setup-route unit regression reaches ordinary validation without inserting a credential. No production POST diagnostic or owner mutation was performed; the workspace automatic reviewer rejected that proposed test. Live submission remains for the owner after checked corrective release.

## Developer connection recovery — 2026-10-13

Source adds fixed-callback dynamic developer registration, RSA/PKCE mobile handoff, explicit TEST profile consent and authenticated JSON token exchange while preserving existing public OAuth clients. First-time Hub owner setup consumes a short-lived activation once and stores a scrypt verifier; existing configured owner authentication wins. Migration 007 is additive. No deployment or hosted acceptance is claimed before checked release and genuine owner consent.

Private single-runner checkpoints use an authenticated external secret store, with no credentials in Git or Library. Checkpoint helpers reject foreign origins, malformed credentials and pending requests; restoring never overwrites an already-rotated local record. Repo Management uses the existing Hub Vercel project, Development-only encrypted RTOOL_BUILDER_SESSION, through the authorized control-plane connector. Save after every credential mutation and before stopping; load before asking for repeat consent after a reset. This is a serialized runner checkpoint, not a distributed shared-token pool.

## Authentic developer connection and refresh — October 13

Provenance: see `docs/developer-evidence.json` upstream_observations for exact standalone
origins, deployed commits, checked client revision and concrete observations. These are
CLI-to-standalone-service checks; they do not close the hosted Hub runtime layers.

GitHub and Google native OAuth consent/token exchange and authenticated MCP initialize
passed against their own deployed servers. GitHub provider reads and scope denial passed;
Google Gmail identity matched the selected account. Live testing found Google omits a
rotated refresh token; the CLI preserves the existing renewable grant in that case.
Regression tests cover omission, rotation, malformed responses and initial authorization.
Credentials remain in the private runner vault. Full provider/Hub/revocation/cleanup
acceptance is not inferred from these checks.

## Hub proof correction — 2026-10-13

The evidence gate now rejects standalone native MCP calls and bare RTC calls as Hub acceptance. A verified Hub layer needs an actual Hub-mediated RTC route and readback. Regression checks passed. Real provider and hosted Hub acceptance remain unverified; this schema does not manufacture proof.

## Review corrections — 2026-10-13

Developer connection retries retain encrypted codes until expiry, concurrent starts use an atomic trusted-IP quota, and backend failures remain retryable. Google consent preserves the requested profile and supports actual native code length. Windows protected credentials fit bounded chunks; cloud refresh locks recover after process exit. Evidence requires every layer and genuine custom-service read/write/denial/readback observations. Production functionality remains intact. Local regression checks passed; exact-head CI, deployed connection, provider, Hub, revocation and cleanup proofs remain separate.

**CI reliability correction:** Hub run 38428765220 failed before any SQL test because the
public ECR PostgreSQL mirror returned toomanyrequests/Data limit exceeded. Use the same
official PostgreSQL 17 Docker Hub image in both isolated service jobs; retain reviewed
immutable Stripe source, all original tests/healthchecks and every aggregate CI requirement.
GitHub documents public Docker Hub pulls on hosted runners as exempt from pull rate limits:
https://docs.github.com/en/actions/reference/limits#docker-hubs-rate-limit-for-github-actions
Generated rtool agent instructions now distinguish native developer access and product use.

**Developer hosting access repair:** Several production-hosted MCP services retain Vercel
SSO (all-except-custom-domains). Native OAuth alone cannot reach them. The developer client
now supports an existing short-lived workload identity scoped to explicit Vercel origins,
without disabling protection or replacing service authentication. Appropriate Trusted
Sources caller/environment rules and actual protected client execution remain unverified.
The CI fleet test was stale: it asserted Neon/Vercel were unconfigured; update it for the
verified host inventory while retaining a synthetic missing-origin regression.

## Reusable developer OAuth and evidence boundary — 2026-10-13

Owner authorized replacing repeated manual pass setup with renewable implementing-agent
connections. Production product capabilities remain unchanged; full developer TEST/preview
profiles retain original server write/financial/resource guards. Native OAuth owner consent
hands authorization back to protected client storage via PKCE plus an encrypted mobile callback.
The rtool developer client reuses/refreshes that connection and invokes the actual custom MCP.
The completion recovery review records catalog/runtime differences, obsolete recipes and
a finite path to finish the intended products without introducing blanket limitations.
Source/automated/deployed/provider/Hub/revocation/cleanup evidence remain separately tracked
in developer-evidence.json. Standard connectors remain development infrastructure aids only.
New handoff/client regressions and mandatory provenance checks are part of this PR; exact-head
CI, reviewed release and real owner consent/provider acceptance remain pending. Managed cloud clients use an explicit private encrypted developer vault; desktops may use
the OS keyring. Never place credentials in a prompt, Git or plaintext credential file. This is an implementation checkpoint, not full real-world acceptance.
See pr-cards/DEVELOPER-CONNECTION.md. No production provider activation or paid resource change.

## 2026-10-13 H-2 per-grant TEST activation — PR #149 proposed

Adds additive 006 SQL for active/disabled registry and per-grant verified_at
proof. A separately owner-authenticated browser step decrypts exactly one
owned still-live grant in memory, requires a connection-time DNS-pinned TLS
RTC1 contract and TEST/read_only whoami with all grant areas, rechecks its
Hub caller and atomically marks only that grant verified before switching
its pending registry origin to active. Active grant resolution now refuses
unverified, revoked, expired or no-longer-live Hub caller identities. Owner
disable also handles active registry; source SQL tests exercise stage,
scope-proof refusal, ownership, activation, resolver and revocation. No
upstream credential was provisioned or used against a live host in this PR:
fixture inspector only; 006 is not applied to production here. Gateway
provider dispatch remains disabled and actual hosted acceptance OPEN.

## 2026-10-13 H-2 pinned authenticated TEST identity preflight — PR #148 proposed

Extends the guarded H-2 HTTPS transport to the **only** allowed bearer-read
path, GET /api/whoami. The public contract probe stays credential-free.
Each request independently resolves socket-time DNS, rejects unsafe/private
IPv4, retains SNI/certificate hostname, refuses redirects, and bounds bytes
and time; only exact-format separate RTC service passes are accepted. A
caller-grant identity preflight refuses live/production, full profile, writes,
wrong service manifest and missing required areas, without echoing upstream
identity. Source fixtures prove permitted flow and refusals, not a real pass.
All registry rows/grants remain pending/noncallable; no production credential,
provider call, active routing, DB mutation or live release is made. Real
upstream grant and deployed two-service acceptance remain OPEN.

## 2026-10-13 H-2 owner encrypted grant administration — PR #147 proposed

Adds /api/owner/grants with independently verified owner-only encrypted
TEST/read_only RTC grant staging, metadata-only listing and immediate revocation.
The UI fixes one-day duration and refuses malformed caller UUIDs, duplicate
areas and service-pass shapes; it never echoes the upstream pass or widens
mode/profile. Existing H-2 SQL validates caller grant and persists AES-GCM
ciphertext under HUB_GRANTS_KEY; missing key remains fail-closed. No service
can route a pending staged grant, and no pass was actually enrolled through
production. Source tests cover denial, lockout, escaping, non-disclosure,
revoke and exact stage parameters. H-1 live owner verifier, verified active
registry, controlled H-3 routing and authentic two-service TEST acceptance OPEN.

## 2026-10-13 H-2 verified-owner staged registry UI — PR #146 proposed

Adds /api/owner/servers for independently password-verified server staging,
owner-only listing and disabling, with no-store/CSP browser responses. Browser
input cannot supply RTC metadata counts: the server first performs an uncredentialed
DNS-pinned TLS contract probe (from #145), matches expected RTC1 identity and
TEST/read_only claims, then saves only pending noncallable SQL metadata. Denials,
lockout, duplicate fields, fake claims and cross-site markup are covered by unit
tests; production owner verifier configuration remains absent and no service grant
or provider call was exercised. **Source and CI only, not authenticated live
setup, owner acceptance or activation.** Strict H-2 granting, owner grant UI,
real verified active registry, H-3 routing and two-service proof remain open.

## 2026-10-13 H-2 DNS-pinned RTC contract probe — PR #145 proposed

Adds a fail-closed HTTPS-only /api/contract probe for already-staged RTC service
origins. Node HTTPS retains the canonical hostname for TLS verification but the
socket lookup pins one globally routable IPv4 address and refuses all mixed,
private, metadata and reserved DNS results. Redirects are not followed, response
size/time are bounded and manifest identity/TEST/read_only checked. Synthetic
injected-transport tests cover DNS rebinding, TLS options and denial paths.
**This does not activate any service, send any credential, stage a grant, update
live database or prove real hosted TEST acceptance.** IPv6-only origins remain
pending; follow-on work must independently verify activation, owner UI, per-caller
narrowing, revocation and audited provider routing. This PR permanently records
owner preference: if the nearest alignment would require only one PR, aim for
six significant PRs to the following multiple. Exact-head CI is required.

## 2026-10-13 H-2 caller-specific encrypted grant staging — PR #143 proposed

Building on #142's noncallable pending server registry, #143 adds a distinct
HUB_GRANTS_KEY gated, AES-256-GCM encrypted RTC pass per exact Hub caller or OAuth
session and service, requiring a valid TEST/read_only gateway identity. Owner-only
metadata and revocation are source implemented; SQL prohibits duplicate live grant.
No active registry states exist: all grant resolution for network calls stays closed.
Independent service-issued credentials, deployment env configuration, real owner
TEST issuance, live host proof, H-2 origin pinning and H-3 routing are OPEN.
One additive 005 migration with disposable PostgreSQL tests; no production DB
change is made in this development PR. Exact-head CI/review required.

## 2026-10-13 H-2 registered-origin staging — PR #142 proposed, source only

Verified live start: main/live 6584b18a7a810895021aaeb3f9c6343a5f7ca514; Vercel production READY at this revision. H-1 owner `HUB_OWNER_SCRYPT` remains absent, login fails closed. H-2 now stages untrusted RTC1 manifest claims and public DNS origins in noncallable owner-bound SQL rows; **it never routes or contacts a service**. Real DNS-pinned connection safety, independently scoped encrypted grants, H-2 owner UI, H-3 federation, RTC1 Hub conformance and deployed authenticated TEST acceptance remain OPEN. Migration 004 requires separately checked deployment before use; no production mutation or service pass was performed. Dynamic next-multiple-of-five and mandatory incomplete-session pause policy now governs AGENTS and SESSION-START. Exact-head PR CI required before merge.

**Setup checkpoint — 2026-10-13:** Stage-aware setup applied: seven Hub-owned additive tables provisioned in existing Toolkit database; Production-only HUB_DATABASE_URL/HUB_TOKEN_PEPPER/HUB_RESULTS_KEY Secrets and HUB_OWNER_ID/HUB_PUBLIC_ORIGIN Config set. Existing 0.25 CU/300-second compute reused. HUB_OWNER_SCRYPT absent, so owner auth remains fail-closed pending private verifier setup. H-2/H-3 federation and relay bindings remain inactive. All six release workflows target 00:01 America/Denver, Vercel tracks live, Basic queued builds and disabled automatic previews verified. No scheduled release event observed yet; owner authorized one manual release after green checks. Saved configuration, deployed exact revision and authentic connected acceptance remain separate.

**Owner release timing update — 2026-10-13:** Daily checked main-to-live release now targets 00:01 America/Denver using GitHub native timezone support, so both daylight and standard time remain 12:01 a.m. All exact-head CI, atomic daily-marker, fast-forward, preview/build-cost and independent live/provider approval gates remain unchanged. Owner separately approved one manual release after this setup work completes; schedule syntax/CI, actual deployment and connected acceptance remain distinct evidence. GitHub scheduling can be delayed; no guaranteed start time is claimed.

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

### October 15 Workspace P8-5 dependency — conformance fixture inputs

Consumer-requested K-2 completion: explicit bounded provider fixture arguments,
complete authorized catalog traversal and strict numbered UTF-8 result recovery.
The runner's existing assertions, negative reference cases and secret boundaries
remain. New fixture/invalid-input/paging tests prove selectors cannot waive checks.
This is a dependency of the same unfinished Google Workspace P8-4/P8-5/P8-7
workload, not a new Hub bundle or external D-4 acceptance. No deployment/spend.
Follow-up review of #213 retained the original initial-success-envelope assertion
at the new shared recovery boundary; failure cannot be laundered through a handle.

**Owner-approved retry safety:** A real network failure after Hub seals a
new credential can strand one unverified pending slot per caller. The same
new passphrase-approved onboarding form now checks a refreshed provider
whoami BEFORE cancelling exactly the old nonverified grant; it uses the
existing lifecycle audit and immediately stages/verifies the new pass.
It cannot cancel an active verified grant or act for a different owner or
caller. A disposable PostgreSQL test proves failure, narrow retirement,
successful retry and retained verified grant. Unauthenticated retries
do not inspect or cancel pending state.

**Additional post-activation audit repair:** The direct Hub RTC listing door
still used the obsolete underscore-only server selector even though the
registered canonical Workspace RTC name includes hyphens. It now reuses the
same reviewed `serverNamePattern` as the registry and federated dispatcher;
the matching unit contract proves exact Workspace selection and rejects
path/domain aliases. The previous owner wizard unit mock also lacked the
newly audited nonverified-grant lookup: it has been adjusted without
weakening any authorization assertion. No provider-specific privileges
or tool writes are granted by this change.
