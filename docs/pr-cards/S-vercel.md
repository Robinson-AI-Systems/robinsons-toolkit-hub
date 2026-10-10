# S-vercel — Start the Vercel server

Status: **MERGED** (done in `Robinson-AI-Systems/vercel-mcp`, 2026-10-10). Batch S (`docs/designs/BATCH-S.md`). Done ahead
of K-1 at Chris's request (BATCH-S amendment 2026-10-10); K-1 re-checks this server's plan against the contract.

## What was produced (in `Robinson-AI-Systems/vercel-mcp`)

- The full plan system copied from the Stripe MCP and adapted (AGENTS, SESSION-START, PLAYBOOK, drift protocol, designs,
  PLAN, MASTER-ROADMAP, STATUS, OWNER-INPUTS, GO-LIVE-CHECKLIST, DECISIONS, ROADMAP, OWNER-GUIDE, AI-PR-READ-FIRST).
- `docs/audits/2026-10-10-research.md` (server playbook §2 steps 1–10, coverage matrix builder / owner / operator,
  official-connector comparison) and `docs/audits/2026-10-10-prior-tools.md` (every Vercel tool the older Robinson
  toolkits built or planned, mapped: covered, universal, dropped with a reason, or added).
- `docs/TOOL-CATALOG.md`: 236 tools (232 hand-built + 4 universal), every name starting with `vercel_` (contract §3).
- `docs/APP-NEEDS-APPLIANCE-DESK.md` (completeness check; optional project profile).
- Card A-1 built and merged there (PR #1): Node 24.x package and lockfile, a fake Vercel that validates requests against
  the vendored API description, throwaway-Postgres tests, check scripts, CI with one `ci` gate shown red by a temporary
  failing test and then green. Cards A-2 and A-3 written; next card A-2.

## Owner inputs (in that repo)

IN-00 formal plan approval and IN-01 (public, no automated review) to confirm; the rest gate later cards only.
