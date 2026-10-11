# STATUS — current work, blockers and next action

Updated 2026-10-11. RTC 1 conformance, direct rtool commands and SDK/agent setup are built;
the central hub server and relay are not yet built.

## Next

- **D-1 complete (#15):** standalone rtool CLI accepts multiple servers, secure keychain
  login, real guarded HTTPS tools, SDK generation and agent setup; TypeScript compiler
  verifies generated declaration files. Immutable cli-v1 tag runs on the merged main.
- **Next:** D-2 local stdio MCP for two configured servers, then D-3 encrypted GitHub relay.
- **External gates:** real per-OS keychain smoke and any real deployment/owner secret
  authorization still require owner-side setup and must never be assumed complete.
- **D-1c as merged (#14):** OS keychain adapters, hidden pass input, guarded login/logout,
  with environment passes taking precedence and missing keychains handled safely.
- **Next:** D-1 TypeScript SDK typecheck and cli-v1 release, then D-2 local MCP.
- **D-1b merged (#13):** SDK generation from service metadata, verified guarded SDK calls,
  rtool skill and managed agent init (preserves existing AGENTS instructions).
- **Next:** D-1 secure OS keychain login and full CLI/type-check verification, then D-2 local MCP.
- **K-3** shared-core extraction waits on Stripe MCP Batches A–C. No legacy compatibility.
- **External services:** all standalone servers remain independent; check their current repo
  implementation state rather than relying on older progress claims.

## Environment

- Repo `Robinson-AI-Systems/robinsons-toolkit-hub` (created by Chris 2026-10-10; public, no automated review). First commit straight to `main` because the
  repository was empty; every later change goes through an `ai/*` branch and a PR.
- Relay repository, Vercel project and Neon database: not created (IN-03, IN-02).
- Old toolkit `Robinson-AI-Systems/robinsons-toolkit-mcp`: reference only (no compatibility; Batch M dropped 2026-10-10).

## Recent merges (newest first)

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
