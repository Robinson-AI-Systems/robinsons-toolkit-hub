## 2026-10-31 — RTC 2 adopted as RTC 1's §9 successor; the RTC 1 freeze holds (R-3 disposition)

Owner ruling (Chris, 2026-10-31). All five open decisions in the RTC 2 draft are ruled as recommended:

- **D1 — Result recovery = content pages.** RTC 2 §7 stands as written: recovery serves byte-exact content pages over the canonical result serialization, 1-based, scope-bound, 24-hour handles.
- **D2 — OAuth is optional-but-specified in RTC 2.** Passes remain the required baseline transport (§4.2); a server that offers the OAuth transport follows §4.3 exactly and declares it in its manifest.
- **D3 — Handle lifetime = 24 hours**, carried from RTC 1 (`handleTtlSeconds: 86400`).
- **D4 — The health path is included in the advertisement** as a SHOULD-level manifest field (§2.1).
- **D5 — The R-3 disposition is the composite.** The RTC 1 freeze HOLDS (option (b): no shipped dialect is amended to chase the unversioned post-freeze suite), AND RTC 2 is adopted by this dated decision as RTC 1's §9 successor.

Why the freeze holds: after the RTC 1 freeze (2026-10-11), the hub conformance suite drifted at HEAD (`e6cfb98`) from the frozen reviewed pin (`e76b1f8`) — its catalog probes demand `page=N` walks where shipped servers paginate by cursor, and its result-recovery probes demand a shape the frozen text never pinned — with no new RTC version and no dated decision, which RTC 1 §9 requires for any post-freeze incompatible change. Ratifying that drift inside RTC 1 (option (a)) is declined: it would teach every future suite that the freeze is negotiable. R-3 therefore completes against the frozen pin suite, with the divergence recorded (RTC 2 §11 rule 6 states the disposition; each server records it in its own docs as it executes).

RTC 2 (`docs/RTC-2-SPEC.md`, filed as adopted alongside this entry) is the successor version §9 always required before the dialects could legitimately move: the drift's sound ideas — server-declared fixtures, content-page recovery — enter as RTC 2 text under a new version, and the conformance suite is re-derived from that text, never normative over it (RTC 2 §11). RTC 1 remains frozen and valid until each server migrates by its own card. Adoption of RTC 2 by the other servers (Workspace, GitHub, Dokploy) happens through their own cards per RTC 2 §12 — noted here, not executed by this entry. Vercel MCP's R-3 card completes against the frozen RTC 1 checks; its RTC 2 adoption is a separate follow-on card.

## 2026-10-21 — approved maximum-authority expansion

Owner requested adapting the completed GitHub planning job to all active custom MCPs.
Approve [MAXIMUM-AUTHORITY](designs/MAXIMUM-AUTHORITY.md), indexed CAP-1..CAP-5,
with provider-specific interfaces, credential types, guardrails and open acceptance.
No artificial God-Mode-only tools or percentage coverage from catalog counts.
Existing user-selected policy/provider isolation and developer spending/release gates
remain binding. This document is not implementation or live verification.

**2026-10-19 — native remote MCP issuer registration must support actual independently owned coding-agent OAuth callbacks (H-1/H-4).** A hosted `/api/mcp` door advertising RFC7591 OAuth discovery is not generally connectable if its dynamic registration hardcodes the Hub's developer-handoff redirect. Preserve the existing secure handoff, but implement independently registered exact external HTTPS/native loopback callbacks; token-bound S256 PKCE; separately owner-selected TEST/LIVE/per-provider scopes; both public `none` and confidential `client_secret_post` client methods; issuer-bound refresh/revocation. Registrations grant zero owner/provider access absent original owner password and explicit delegation. Protect new schema with additive migration 028, real disposable-DB tests, approval before production SQL, and separate checked source release. A genuinely operating desktop and mobile client and LIVE Hub→Workspace provider reads remain external acceptance, not declarations based on source CI. No broader Hub planner, bespoke provider code, public publication or developer spending-policy leak is authorized.

**2026-10-19 — Hub supports modern and legacy direct remote MCP without a platform-specific adapter.** Current published MCP `2026-07-28` is stateless (per-request capabilities/version, mandatory `server/discover` and mirrored headers); Hub retains its older 2025 handshake transports and the fixed owner-authenticated `hub_*` tools. Both eras must carry the *same* real caller and independently delegated upstream rights; version negotiation must never create or widen grants. The Hub itself is a direct MCP gateway, not a provider-specific MCP reimplementation, and no one client platform (desktop, mobile, ChatGPT web/cloud adapter) is a required dependency. Source and actual client/service acceptance remain separate; existing private plugins are not publicly listed. Official spec: https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning and https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http.

**2026-10-19 — Universal MCP connectivity, attribution and end-user authority (owner directive).** Hub's primary product is a directly usable remote MCP **gateway** (one small fixed agent menu, lazy thousands-of-tools federation). It must be independently connectable by standards-compliant desktop/mobile coding agents where the platform actually supports remote MCP; any ChatGPT cloud alias, relay, CLI or custom plugin is optional, not a product dependency or proof of a native direct connection. Hub is not a duplicate provider service and neither owner nor agent planning moves to Hub. Private product display name: **Robinson's Toolkit Hub by Robinson AI Systems**, preserving original MCP machine identity and prefix, without official-provider endorsement or public plugin listing. Standalone providers separately implement their own native MCP, product branding and owner/issuer permissions. Developer-agent TEST/$0/release/nonproduction safeguards continue to bind developers; finished products honor actual owner/provider/tenant-scoped user delegation and valid protections instead. Classify and correct any old TEST-only product messaging and product-code denials, never bypass provider checks. The directive does NOT authorize a LIVE Google OAuth sign-in, real write, money movement, production database change or private plugin publication; require separate action approval where necessary. See `docs/audits/2026-10-19-direct-mcp-branding-authority.md`. H-1/H-3/H-4 product acceptance remains OPEN until real native client and upstream tool proofs.

# Decisions (dated)

**2026-10-18 — Hub is a fixed-context multiplexing gateway, not an AI planner (owner reaffirmation).** A coding agent connects once to Hub and gains selective access to hundreds or thousands of tools on independently operating MCP servers without maintaining each connection or loading provider schemas into the agent context. Hub initiates public RTC1 discovery, performs original user-consented authorization, searches bounded provider metadata and routes guarded selected calls. The human and their coding agent plan. Hub C-1 preview/execute orchestration is optional and does not autonomously plan. Frozen RTC1 and independent direct doors remain mandatory; a provider OAuth client transport is optional and cannot silently replace legacy RTC1 credentials, widen provider rights or create new Hub tool names per provider. Product authorization can ultimately be LIVE and end-user controlled, while our developer-agent tests and deployment gates remain separate. See the October 18 H-2 plan and PR #237; source test acceptance is not hosted continuity.


**2026-10-10 — One standalone server per toolset; Robinson's Toolkit becomes the front door.** After a reality check
showed the old toolkit's 3,049 tools are cheap on context (search-then-call already) but unverifiable (its test script
only checks that keys exist; `TEST_RESULTS.md` claims all functional), Chris chose to build each toolset as its own
solid, hosted server — Google Workspace MCP and Stripe MCP first — and make Robinson's Toolkit the single MCP, CLI and
HTTPS front door combining them. Audit: `docs/audits/2026-10-10-old-toolkit.md`.

**2026-10-10 — Build Chris's own servers even where official connectors exist (Chris).** Official connectors for
Vercel, Neon and others give less functionality, and different agents get different permissions with them. Robinson
servers give every agent the same full tool set with Chris's safety rules.

**2026-10-10 — Servers stay fully usable on their own; build them as needed (Chris).** The hub is a long-term project.
So this repo delivers the direct doors first (`rtool`, local MCP, GitHub relay), which work with any single server
without the hub, and no server ever depends on the hub.

**2026-10-10 — The Robinson Tool Contract (RTC 1).** A written contract (`docs/CONTRACT.md`) every server follows, with a
conformance test, so the hub stays a thin router and every agent sees identical behavior from every server.

**2026-10-10 — Shared code is extracted, not designed up front.** The Stripe MCP writes its contract code in `src/core/`;
this repo extracts it into `robinson-mcp-core` once proven (K-3), and other servers adopt it.

**2026-10-10 — Relay encrypts to the relay's own key.** The GitHub relay seals requests (including the pass) to the
relay's public key, so GitHub sees only ciphertext and servers never need to know about the relay.

**2026-10-10 — Public repository, no automated review**, as for the Stripe MCP.

**2026-10-10 — A general development tool (Chris).** "This should be general, able to work freely on any project … It
is supposed to be a powerful development tool." Real projects are completeness checks only. Added contract §10
(developer conventions: safe modes, runs tagged `rtc_run`, cleanup by run, scenarios, integration checks), a Developer
tools batch (V) to the server playbook, generic purposes in the server roadmap, and development-environment up/down as
the hub's flagship cross-server workflows. Stripe gained its Batch V; Workspace gained P8-7.

**2026-10-10 — Owners and end users too, not only developers (Chris).** "These toolsets should be great for both
developers and end users of each service, account management tools … everything." Contract §3 adds an `audience` tag
(builder / owner / operator); new §11 requires every server to cover the owner side: an admin overview, real tools for
every owner setting with an API, guided settings with structured steps and read-back for everything without one, and a
full dashboard map. The playbook adds research steps 9–10 (owner side, coverage matrix) and a standard batch O; the hub
adds L-4, a guided settings runner that walks dashboard-only settings in a visible browser with Chris approving each step
(never typing passwords). The old toolkit's audits had found account, team, billing and security tools "broadly absent".

**2026-10-10 — Two rules from the Workspace server's review (RTC 1 clarification).** An automated review of the Google
Workspace MCP plan (its PR #28) found that (1) an OAuth refresh could drop a connection's settings (a read-only
connection becoming full access) and (2) an in-memory rate limit does nothing on serverless hosts. Contract §2 now
requires both (settings copied on refresh; limits counted in the database), conformance checks both, and the hub, relay
and Stripe plans follow. RTC 1 is not final until K-1, so this is a clarification of version 1, not a new version.

**2026-10-10 — Tool names always start with the server prefix; Node 24.x (RTC 1 clarification).** Planning GitHub,
Vercel and Neon together showed shared nouns (project, branch, member, workflow, webhook, admin) across servers that are
loaded into one chat; some clients don't namespace tools by server. Contract §3 now requires `<prefix>_…` on every tool
name. Vercel stopped deploying Node 20 on 2026-10-01, so every server and the hub use Node 24.x. Still a draft
clarification of RTC 1 (before K-1). Stripe and Workspace adopt through their own cards (STATUS).

**2026-10-10 — K-0: the hub gets a code foundation card before K-2.** The plan went straight from docs (K-1) to the
conformance package (K-2) with no card creating the repository's checks and CI; every server has A-1 for that. K-0
copies the newest proven foundation (`neon-mcp`) and adds hub-specific secret rules. Scripts that would only pretend
(`test:conformance`, `test:doors`) are left to the cards that first have real tests. K-2 is split (K-2b) to keep PRs
under the 500-line budget. A contract change now always needs a DECISIONS entry in the same PR (enforced by the docs
check).

**2026-10-10 — No compatibility with the old toolkits; Batch M dropped (Chris).** "The reference to the older toolkits
was to help make sure you designed this custom MCP with as much functionality as possible … I don't need legacy
compatibility." Batch M (freeze, smoke test, namespace map, `--legacy` bridge, retirement checklist) is dropped and its
design moved to `docs/archive/`; IN-05 answered "not needed". The old toolkits stay what they were meant to be: a
checklist each server's gap check covers. Servers drop their old-name maps and toolkit decision notes the same way.

**2026-10-10 — Stronger anti-stall rules (from the implementing agent's own diagnosis).** Sol stopped after opening a PR
with red CI although nothing blocked it. Its reasons: too much code before running tests; preventable CI errors (a wrong
API parameter, lint, outdated test expectations); no rule forcing a red PR to be finished first; and chat sessions that
end between actions. Added: SESSION-START §0 (finish open PRs first), §6 (problems vs real blockers, thin slices, a
no-shell path with draft PRs, an exact recovery point at every push) and AGENTS rules 11–13.

**2026-10-11 — K-1 freezes RTC 1 and makes conformance evidence explicit.** Reviewed Stripe Batch R, Workspace
Phase 8 and the GitHub/Vercel/Neon Batch R plans; all five plan the same RTC 1 doors and guarded
passes, while their rate defaults (Neon 60/minute; others 120/minute) deliberately differ per service.
The source trees of all five showed no `/api/contract` implementation when checked for the freeze.
Pass values use `rtc_pass_` plus 43 unpadded base64url characters from 32 random bytes, which secret scanners
catch by shape. Conformance role passes are passed only through named environment variables; missing
roles show `skipped`, never passed. The rule-to-test table names service-specific checks where a wire-level
probe cannot prove one-time issuance, database behavior or owner dashboard coverage. A later contract
change requires RTC 2 (or newer), not an in-place clarification.

**2026-10-10 — CI cadence (from the implementing agent's review of its own CI use).** Every push runs the full CI on
purpose (the merge gate must be green at the exact head). The waste was pushing fixes while a run was still going, which
started overlapping full runs. Rule added to SESSION-START §6: never push while your PR's run is in progress; collect all
failures, fix them together, push once; run checks locally first; "re-run failed jobs" only for infrastructure hiccups.
CI cancels an obsolete PR run when a newer push arrives.

## 2026-10-11 — encrypted relay completion and session handoff
D-3b isolates hosted security; D-3 completes exact RTC path routing and cleanup.
Hourly cleanup uses an inert owner-configured GitHub job rather than provisioning
a paid cron. This does not authorize activation or spending. Direct POST requests
with ambiguous outcomes never automatically retry via relay.
Chris requests five merged PRs per chat and a concise repo-documentation-based
handoff; this particular chat ends after PR #20, then normal five-PR sessions resume.

## 2026-10-11 — D-4 honest real-run boundary
D-4a ships environment recipes and a read-only verifier using named environment
credentials and neutral output. It defaults to localhost and refuses full passes
or writing/money/destructive metadata. Real-run opt-in is a technical control, not
owner authorization. Actual three-environment evidence and pass revocation remain
D-4 WAITING_ON_OWNER; no fake tests stand in for real certification.

## 2026-10-12 — owner-requested universal gateway architecture recovery

Reviewed current six-repo source; [verdict, ownership and finite acceptance](audits/2026-10-12-gateway-architecture-recovery.md).
Remove K-3 from H-1; use K-1/K-2/D-2. K-3 remains optional PRIVATE/NOT_READY with all existing gates.
Service dispatch/credentials/state/approvals stay service-owned behind frozen RTC 1. Fixed gateway listing,
minimal grant narrowing/audit and bounded discovery/results are first-slice requirements; real two-service
proof is separate from D-4 and package adoption. No frozen RTC wire change, production or spending approval.
Explicit owner docs/planning request authorizes focused planning PRs; routine no-docs-only cadence is unchanged.

## October 14, 2026 — owner-delegated concrete implementation designs

The owner requested completing/revising remaining designs, then extending the
same Sol 5.6 implementation detail to all six active custom MCP repositories.
[IMPLEMENTATION-GUIDE.md](implementation-contracts/IMPLEMENTATION-GUIDE.md) adds typed state/argument/result
contracts, domain-specific failure and recovery cases, current code seams and
finite proof requirements for the remaining indexed scope. This is an explicit
design-maintenance exception to routine no-docs-only implementation work, not a
feature PR or completed subsection. Existing owner-specific missing inputs,
spending/production/credential/cleanup authority remain gated; this entry does
not mark them answered. The original Toolkit stays reference-only.
