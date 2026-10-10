# START HERE — Robinson's Toolkit

The hub and the shared pieces for all of Chris's tool servers. Servers stay fully usable on their own; this repo makes
them usable by any agent from anywhere (CLI, relay, local MCP) and, later, from one front door (the hub). Chris
operates mostly from a phone; everything he reads must be plain language.

## Read only what this work needs

1. Implementing a card: [SESSION-START](SESSION-START.md). Otherwise AGENTS — workflow and hard limits.
2. [STATUS](STATUS.md) → [MASTER-ROADMAP](MASTER-ROADMAP.md) → the card → the cited design headings.
3. The contract: [CONTRACT](CONTRACT.md), one section at a time.
4. Starting a new service server: [kit/SERVER-PLAYBOOK](kit/SERVER-PLAYBOOK.md) and [kit/SERVER-ROADMAP](kit/SERVER-ROADMAP.md).

## Code map (target; confirm actual paths before editing)

`packages/conformance` contract tests + reference fake server · `packages/cli` the `rtool` command (CLI, SDK generator,
local MCP, local tools) · `packages/core` `robinson-mcp-core` (from K-3) · `packages/hub` the hub server · `api/` Vercel
functions (hub connector and HTTPS doors, `relay/github.js`) · `docs/kit/` server playbook, roadmap, templates.

## One authority per fact

| Fact | Authority |
|---|---|
| What every server must do | CONTRACT |
| Workflow / hard limits | AGENTS; PLAYBOOK for commands |
| Current state / order | STATUS / MASTER-ROADMAP / `pr-cards/work-index.json` |
| Acceptance | PLAN |
| How each batch works | `designs/BATCH-*.md`; the card for exact execution |
| Which servers, in what order | `kit/SERVER-ROADMAP.md` |
| How to build a server | `kit/SERVER-PLAYBOOK.md` |
| Owner-only inputs | OWNER-INPUTS |
| Historical evidence | `audits/`, `archive/`, dated DECISIONS |
