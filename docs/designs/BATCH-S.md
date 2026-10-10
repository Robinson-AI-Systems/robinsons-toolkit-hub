# Design — Batch S: Starting each service server (as Chris needs it)

Status: **APPROVED** (Chris, 2026-10-10: "I will be building the individual tool sets as I need them"; and his own
Vercel/Neon servers rather than relying on official connectors, because those give less functionality and agents get
different permissions with them). Scope: `docs/PLAN.md` → Batch S.

Batch S cards are **planning** cards: each creates one new service server's plan, ready for implementation in its own
repo. They are written just in time, when Chris says he needs that server; the order and grouping are in
`docs/kit/SERVER-ROADMAP.md`; the method is `docs/kit/SERVER-PLAYBOOK.md`.

## 1. Decisions

**S1. One card per server:** `S-<server>` (e.g. `S-vercel`). Output, in the new repo (created by Chris): the full plan
system from `docs/kit/templates/` (or `rtool new-server` once K-4 exists), the tool catalog, designs, owner inputs and a
ready first card. This repo records the card and updates the roadmap.
**S2. Each server follows the playbook's definition of done**, including RTC conformance, before the hub registers it.
**S3. Existing servers** (Google Workspace MCP, Stripe MCP) are not S cards; they reach the contract through their own
plans (Workspace Phase 8, Stripe Batch R).

## Amendments

**2026-10-10 — S-github, S-vercel and S-neon ran before K-1 (Chris: "these are extremely high priority … the stack I
currently use for everything").** Each followed the playbook and the RTC 1 draft as it stood that day; K-1 now compares
the contract with all five server plans (Workspace, Stripe, GitHub, Vercel, Neon), not two. Their cards record what was
produced (`docs/pr-cards/S-*.md`).
