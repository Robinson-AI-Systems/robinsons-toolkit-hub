# STATUS — current work, blockers and next action

Updated 2026-10-11. Plan written by Claude (Opus 5.5) in the Appliance Desk planning system. **Repository foundation
built (K-0):** checks, unit and database test harnesses, CI with the `ci` gate. No product code yet (no package, door
or server).

## Next

- **Ready now:** **K-2 — conformance package and reference fake server** ([card](pr-cards/K-2.md),
  code, medium effort). Branch `ai/<tool>/k-2-conformance` from latest `main`.
- **K-1 complete (#9):** RTC 1 frozen; rule-to-check mapping, pass formats and skipped-check reporting documented;
  five service plans checked and the token-shape secret scan hardened.
- **Then:** K-2b (refresh keeps settings, two-instance rate limit; write its card at start), then D-1.
- **Elsewhere in the program:** Stripe MCP is being built (A-1 … A-5a merged by Sol); Google Workspace MCP Phase 8 plan
  merged (its PR #28/#29). **GitHub, Vercel and Neon servers:** plans, gap checks against every older toolkit, and a
  proven A-1 foundation merged in each repo (2026-10-10); next card A-2 in each.
- **Adoption proposals for the existing servers** (executed through their own cards, never from here): Stripe and
  Workspace move to Node 24.x, and Stripe prefixes every tool name with `stripe_` before its first tools are built
  (contract §3); Workspace renames generic areas (`admin_`, `chat_`, `contacts_`, `workflow_` …) during its Phase 8 (no old-name aliases).

## Environment

- Repo `Robinson-AI-Systems/robinsons-toolkit-hub` (created by Chris 2026-10-10; public, no automated review). First commit straight to `main` because the
  repository was empty; every later change goes through an `ai/*` branch and a PR.
- Relay repository, Vercel project and Neon database: not created (IN-03, IN-02).
- Old toolkit `Robinson-AI-Systems/robinsons-toolkit-mcp`: reference only (no compatibility; Batch M dropped 2026-10-10).

## Recent merges (newest first)

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
