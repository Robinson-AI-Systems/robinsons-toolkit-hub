# STATUS — current work, blockers and next action

Updated 2026-10-10. Plan written by Claude (Opus 5.5) in the Appliance Desk planning system. **No code exists yet.**

## Next

- **Ready now:** K-1 — contract final and kit docs ([card](pr-cards/K-1.md)). Then K-2 (JIT).
- **Elsewhere in the program:** Stripe MCP is being built (A-1 … A-5a merged by Sol); Google Workspace MCP Phase 8 plan
  merged (its PR #28/#29). **GitHub, Vercel and Neon servers:** plans, gap checks against every older toolkit, and a
  proven A-1 foundation merged in each repo (2026-10-10); next card A-2 in each.
- **Adoption proposals for the existing servers** (executed through their own cards, never from here): Stripe and
  Workspace move to Node 24.x, and Stripe prefixes every tool name with `stripe_` before its first tools are built
  (contract §3); Workspace renames generic areas (`admin_`, `chat_`, `contacts_`, `workflow_` …) with old names kept as
  aliases during its Phase 8.

## Environment

- Repo `Robinson-AI-Systems/robinsons-toolkit-hub` (created by Chris 2026-10-10; public, no automated review). First commit straight to `main` because the
  repository was empty; every later change goes through an `ai/*` branch and a PR.
- Relay repository, Vercel project and Neon database: not created (IN-03, IN-02).
- Old toolkit `Robinson-AI-Systems/robinsons-toolkit-mcp`: still Chris's local tool; freeze proposed in M-1.

## Recent merges (newest first)

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
