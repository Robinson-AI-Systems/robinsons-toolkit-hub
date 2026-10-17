# START HERE — Robinson's Toolkit

## Current Workspace integration acceptance — October 17, 2026 UTC

D-4 is complete for the independent Workspace RTC service: original separate local direct, GitHub-only encrypted relay and Vercel Sandbox direct runners passed; native audited Hub read, TEST/read-only refusal, same-pass issuer revocation and all temporary cleanup are verified. See [D-4](pr-cards/D-4.md) and [the exact sanitized receipt](audits/2026-10-17-d4-final-route-acceptance.json). Other Hub fleet/service, optional core publication and remaining roadmap obligations stay separately open in STATUS; this does not declare the whole Hub project complete.

The temporary relay is now disabled: webhook inactive, routing maps empty, issue closed/zero comments, disposable passes/token and ingress bypass revoked, Sandbox stopped. Existing hosted credentials and useful standing Hub grant are preserved. Activation for a new agent/service needs its own approved binding and scoped credentials; never reuse revoked test material. Workspace remains fully standalone and does not discover Hub.


The hub and the shared pieces for all of Chris's tool servers. Servers stay fully usable on their own; this repo makes
them usable by any agent from anywhere (CLI, relay, local MCP) and, later, from one front door (the hub). Chris
operates mostly from a phone; everything he reads must be plain language.

## Read only what this work needs

1. Implementing a card: [SESSION-START](SESSION-START.md). Otherwise AGENTS — workflow and hard limits.
2. [STATUS](STATUS.md) → [MASTER-ROADMAP](MASTER-ROADMAP.md) → the card → the cited design headings.
   For concrete execution, [implementation guide](implementation-contracts/IMPLEMENTATION-GUIDE.md) §1 selects one bounded recipe.
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
