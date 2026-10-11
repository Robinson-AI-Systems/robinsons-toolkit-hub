# STATUS — current work, blockers and next action

Updated 2026-10-11. RTC 1 conformance, direct rtool commands and SDK/agent setup are built;
the central hub server is not yet built; the relay server is built but not deployed.

## Next

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
- **D-4 WAITING_ON_OWNER:** real local direct, GitHub-only relay and Vercel Sandbox
  direct runs; owner-approved short-lived passes and subsequent revocation evidence.
  IN-02/03/04 relay resources/keys remain unset; actual OS vault smoke also unverified.
- D-3 code complete (#17–19); no real relay is deployed or connected.
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
- Relay repository, Vercel project and Neon database: not created (IN-03, IN-02).
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
