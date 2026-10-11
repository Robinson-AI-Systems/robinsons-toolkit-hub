# STATUS — current work, blockers and next action

Updated 2026-10-11. RTC 1 conformance, direct rtool commands and SDK/agent setup are built;
the central hub server is not yet built; the relay server is built but not deployed.

## Next

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
