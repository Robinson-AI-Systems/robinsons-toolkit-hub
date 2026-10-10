# Plan templates for a new service server

Until `rtool new-server` exists (K-4), copy these files from `Robinson-AI-Systems/stripe-mcp` at its current `main` and
replace Stripe-specific text (the checklist below). The Stripe MCP is the reference implementation of
`docs/kit/SERVER-PLAYBOOK.md`.

Copy: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/START-HERE.md`, `docs/SESSION-START.md`, `docs/PLAYBOOK.md`,
`docs/implementation-contracts/DRIFT-PROTOCOL.md`, `docs/pr-cards/README.md`, `docs/pr-cards/validate-index.py`,
`docs/designs/TEMPLATE.md`, `docs/designs/CHANGES-SINCE-DESIGN.md`, `docs/AI-PR-READ-FIRST.md`, `docs/ARCHITECTURE.md`
(reset to "nothing built").

Write fresh for the service: `docs/TOOL-CATALOG.md`, `docs/designs/BATCH-*.md` (standard batches from the playbook §3),
`docs/PLAN.md`, `docs/MASTER-ROADMAP.md`, `docs/STATUS.md`, `docs/OWNER-INPUTS.md`, `docs/GO-LIVE-CHECKLIST.md`,
`docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/OWNER-GUIDE.md`, `docs/pr-cards/work-index.json`, the first card,
`docs/audits/<date>-research.md` (playbook §2), and `docs/APP-NEEDS-<APP>.md` for each project profile.

Replace checklist: service name and prefix; hard limits (production/live, money, messages, access); credential type and
setup page wording; mock/test strategy; API version pinning; danger list → guards; project profiles; the contract
version (RTC 1).
