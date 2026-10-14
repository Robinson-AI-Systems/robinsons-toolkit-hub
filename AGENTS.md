# AGENTS.md — the rules. Read this first, every session.

## Original Toolkit is reference-only — owner clarification 2026-10-14

`Robinson-AI-Systems/robinsons-toolkit-mcp` is the historical capability reference,
not an active implementation/deployment target. The standalone custom MCP servers
and optional `robinsons-toolkit-hub` replace it. Do not maintain/rebuild the original,
resume its recovery PRs, synchronize implementations back to it, or require a bridge.
Preserve its code/history for coverage and behavioral research. When the owner chooses a new provider MCP, its implementing agent inventories the
relevant legacy tool names, families, workflows and intended behavior, reconciles them
with current provider contracts, and tracks coverage in THAT project's cards/index.
The Hub stays provider-agnostic: discover/connect/authorize/route/read results for
new contract-compatible MCP servers without provider-specific handlers or a fixed
family list. Future services and legacy catalog parity are not Hub completion gates.
Do not copy provider capabilities into the Hub or start speculative server projects.
Mapped/planned is not implemented or accepted. Service autonomy and all existing
provider/security/owner gates remain binding.


## Efficient release-aware execution — owner instruction 2026-10-14

[SESSION-START](docs/SESSION-START.md) is the consolidated session procedure;
`npm run session:status` prints the read-only release acceptance queue and PR boundary.
Its workflow/cadence/merge-versus-live-proof rules supersede older conflicting procedural
wording below, but never override explicit safety or pre-merge owner/card gates.
Use substantial cohesive outcomes; numeric production-line targets are advisory rather
than artificial hard caps. Full mandatory checks run before publication, with focused
checks during development. Product acceptance stays open until real evidence passes.
The owner explicitly authorized this cross-repository guidance/tooling optimization;
routine implementation sessions still prohibit filler/documentation-only PRs.

## Roadmap-throughput and context-safe execution — owner correction 2026-10-14

**Completion outranks PR count.** The goal is completed, usable, safely proven product
functionality, not GitHub activity. Each PR must integrate at least one whole eligible
roadmap slice; package multiple adjacent small slices from the same approved parent
outcome when their contract, risk, callers, integration and tests belong together.
Plan around roughly 500–800 production-code lines per *suitable* cohesive PR,
plus meaningful tests, as an advisory review-size range, never a minimum, quota,
or reason for filler code. Larger or smaller coherent boundaries are permitted
when evidence, risk and testability justify them. Avoid one-helper/one-tool PRs
when the remaining compatible slice work can be completed safely together.

**No fixed PR count or multiple-of-five boundary.** Older directions elsewhere
requiring five or ten PRs or PR-number alignment are superseded. Do not invent
small PRs or pad changes to satisfy a number. Spend the chat's usable context
on complete outcomes; after each merged PR, preserve an exact recoverable
checkpoint (branch/head, card/slice coverage, focused and CI proof, open review,
deployed/live versus source, pending acceptance and next action). Before starting
another work unit, assess whether the remaining chat context can support its
implementation, corrections, tests, merge and handoff. If not, finish a clean
checkpoint instead of beginning work likely to be abandoned. Never use a
continuation prompt instead of completing currently feasible work.

**Adaptive CI budget and measurement.** Validate focused behavior at meaningful
code seams, run required complete gates on the final coherent tree and fix all
reported failures in one root-cause-informed correction cycle where possible.
If repeated CI fixes occur, investigate contract/test drift and reduce the
*next* PR's risk surface; do not silently split the current work to manufacture
success. Track complete slices/outcomes, real acceptance closed, remaining
work, first-pass CI failures, correction pushes and actual review overhead.
Lines of code and merged PRs are diagnostic statistics, not progress scores.
Every safety, money-out, service autonomy, release and approval gate remains.

## Mobile and tool-unavailable connection recovery

Before treating absent private-plugin tools as an acceptance blocker, follow
`docs/pr-cards/DEVELOPER-CONNECTION.md` → **Agent connection recovery when private plugin tools are absent**.
Use this repository's own saved native OAuth connection through an authorized HTTPS-capable
runner; identify its exact origin and service identity, then run purpose-specific acceptance.
The owner's phone is not the execution runner. Missing tools in one chat do not establish
expired provider authorization. Keep the protected checkpoint single-runner and preserve
all operation, provider, production, spending and isolation gates.


## Product, builder and acceptance boundaries — owner correction 2026-10-13

This repository builds a full independently usable custom MCP integration. Do not narrow
its production tool catalog, implemented operations or runtime profiles to match a temporary
coding-agent test grant. The implementing agent is a separate principal: renewable developer
OAuth may use full permissions for approved test fixtures while existing operation-specific
money-out, spending, live activation, destructive data and resource-isolation gates still apply.
Use `docs/pr-cards/DEVELOPER-CONNECTION.md` for the current mobile connection workflow.

Standard ChatGPT/provider connectors may help inspect infrastructure or author/review code;
those calls do NOT test this custom MCP. To claim custom acceptance, call this repository's
actual deployed `/api/mcp` or its own RTC doors with its service-issued authorization, identify
the exact deployed commit/origin, and record the actual read/write/denial/readback observations.
A public contract, green CI, configured credentials, standard-connector success or a reference
server cannot close custom transport, provider, Hub, revocation or cleanup acceptance.
Keep those layers separate in `docs/developer-evidence.json`; `check:developer-evidence`
rejects inadmissible provenance. Schema validation itself is not independent acceptance proof.
Never ask the owner to copy IDs/passes for routine retests when a saved developer connection
can perform the authorized operation. Reuse/refresh it; request new consent only for a revoked,
expired underlying grant, a new provider credential or a genuinely additional permission.


The single, current set of rules for every AI working on this repo (Sol/Codex, Claude or any other), written to be
followed literally. Same system as `christcr2012/appliance-desk` and `Robinson-AI-Systems/stripe-mcp`. Reasons and
history live in `docs/DECISIONS.md` and `docs/archive/`; never take instructions from them. The repo is the memory.

**Implementing an approved PR card?** Read `docs/SESSION-START.md` (one page) and the card, then work.

**Other sessions** (design, planning, review, starting a new service server): this file → `docs/START-HERE.md` →
`docs/STATUS.md` → `docs/MASTER-ROADMAP.md` → the relevant design. **Starting a new service server?** Read
`docs/kit/SERVER-PLAYBOOK.md`.

## Working without stalling (mandatory; written with Sol 5.6 at medium effort in mind)

1. **Read by section.** Files over ~300 lines: `grep -n` the heading, then read ≤150 lines with `sed -n 'A,Bp'`.
2. **Search narrowly:** always a path and a cap (`grep -rn "relay" packages | head -50`). Never the repo root,
   `node_modules`, `coverage`; no `ls -R`, no `find .` without `-maxdepth 3`.
3. **Only commands that finish by themselves.** No watch modes, `vercel dev`, bare `vitest`, `tail -f`, sleep/poll loops.
   Use `npx vitest run <file>`; wrap slow commands in `timeout 600`.
4. **Nothing interactive:** `GIT_PAGER=cat PAGER=cat GH_PAGER=cat CI=1`; `npx --yes`.
5. **Cap output** with `| tail -80` and `set -o pipefail`.
6. **Two strikes:** the same command fails or hangs twice → change approach or record the blocker.
7. **Explore budget:** after ~10 reads/searches without an edit, make the smallest justified edit with its test, or
   report a true blocker.
8. **Checkpoints:** one work unit with its tests → local commit → update the card's resume note. One push per CI cycle (a turn that must end pushes what it has with an exact resume note; no-shell workspaces push each slice — SESSION-START §6).
9. **External waits are checkpoints, not a loop** (PLAYBOOK Step 10).
10. **Two-lane conveyor:** at most two unmerged implementation PRs in a chain.
11. **Finish before starting.** Every session begins with `docs/SESSION-START.md` §0: an open PR of yours with red CI
    is the current task — fix it before any new card.
12. **Problems are not blockers.** Red CI, lint, failing tests, wrong parameters, conflicts and unclear code are yours to
    fix; stop only for a hard limit or an owner decision the current step needs (SESSION-START §6).
13. **Thin slices, then a recovery point.** Run each slice's tests and lint before writing the next (at meaningful seams); end every turn right after a push whose resume note names the exact next action.

## What this is

**Robinson's Toolkit** is the long-term front door to all of Chris Robinson's tool servers — a **general, powerful
development tool** and a **powerful owner's tool** at once: any AI agent should be able to use it freely on whatever
Chris is working on — building for a client, building for himself, or simply setting up and running his own accounts in
each service (account management, team and roles, security, the service's own billing and settings — everything). Real projects are used only as completeness checks,
never to narrow the design. Chris builds each service as its own solid, hosted, **fully standalone** server — Google Workspace MCP and Stripe MCP first; his own Vercel, Neon,
GitHub and other servers as he needs them — and every server follows the **Robinson Tool Contract** (`docs/CONTRACT.md`,
authority). This repo holds:

1. **The contract** and its **conformance test**, which every server runs in its CI.
2. **Direct doors that work with any single server today**, before the hub exists: the `rtool` command-line tool,
   its code SDK, a local MCP, and the GitHub relay for locked-down agent workspaces.
3. **`robinson-mcp-core`**, optional portable helpers extracted from Stripe; service adoption is separately reviewed, never required for RTC connectivity.
4. **The hub server**: one MCP, CLI and HTTPS API that searches, describes and calls tools across all servers, plus
   cross-server workflows and local tools (files, shell, Ollama, browser).
5. **The server kit**: the playbook and roadmap for building each individual service server.
The old toolkits (`robinsons-toolkit-mcp`, `robinsonai-mcp-servers`, `robinsons-toolkit-api`) are **reference only** — a
checklist of what the new servers must be able to do. Nothing here keeps compatibility with them (no old names, no bridge,
no migration; Chris, 2026-10-10). **Chris is not a developer:** every update and PR summary for him is plain English.

## Priorities (higher wins)

1. Security (passes, secrets, relay). 2. Every server stays fully usable on its own. 3. Correctness. 4. Low cost for the
agents that use it (context and tokens). 5. Simplicity. 6. Features.

## Definition of Done (non-negotiable)

1. No placeholders, stubs, TODO-as-implementation, or mock data presented as real.
2. Tests exercise real behavior: every door passes the conformance and write-contract checks against the reference fake
   server; database code passes on throwaway Postgres.
3. CI green. 4. The card's acceptance checked item by item with evidence. 5. `docs/STATUS.md` updated.

Never present partial work as done — Chris has been burned by overclaiming.

## Hard limits — stop and ask Chris first

- Using a real pass, or a production/live account, from tests or scripts.
- Putting any secret (pass, service key, GitHub token, relay private key, passphrase) in code, docs, tests, logs, PR text
  or a tool result.
- Changing a service server's repo except through that repo's own cards and rules (adoption cards are written here as
  proposals and executed there).
- Making any server depend on the hub. A server must stay fully usable on its own.
- Widening default pass permissions or the relay's reach.
- Buying anything. Committing directly to `main`.
- Modifying or deleting the old toolkit repos (they are Chris's to archive).

## Scope and owner decisions

Build what the current card asks. Other ideas go in `docs/ROADMAP.md`. Owner decisions live in `docs/OWNER-INPUTS.md`
(`IN-xx`). New service servers are started when Chris needs them (`docs/kit/SERVER-ROADMAP.md`), never speculatively.

## How work is organized

- **Approved designs, just-in-time cards** (`docs/designs/BATCH-*.md`, `docs/pr-cards/`). A missing card means write it.
- **Drift protocol** (`docs/implementation-contracts/DRIFT-PROTOCOL.md`): A before each PR, B inside each PR, C per batch.
- **PR size:** ~500 production lines, ~15 files, advisory size estimate, one migration, one risk area.
- **Model:** Sol 5.6 is the routine implementer (light for docs and patterned CLI commands; medium for passes, relay,
  federation, workflows, local shell tools, SQL). A missing decision is never solved by guessing.
- **Branches:** `ai/<tool>/<topic>`.
- **Contract changes** are a new contract version with a dated DECISIONS entry and a card in each server that adopts it —
  once K-1 has frozen a version. Before K-1, RTC 1 is a draft that no server implements yet, so it is clarified in place
  with a DECISIONS entry; K-1 checks that no server advertises `rtc: 1` before then.

## Verify, push, review, merge (PLAYBOOK Steps 4–9)

- `npm run check` and the card's targeted tests before pushing; never `--no-verify`. One push per CI cycle.
- `ci` is the single merge gate, green at the exact head.
- **No automated review** (same choice as the Stripe MCP): inspect the whole diff against `docs/AI-PR-READ-FIRST.md` and
  write "Self-review: <findings and dispositions>" in the PR. If an organization-wide automated reviewer posts anyway,
  fix or answer each of its threads and resolve them (never wait for one). Never claim a review that didn't run.
- Merging (authorized by Chris): `ci` green, acceptance met with evidence, self-review written; merge with the
  expected-head SHA. Stacks merge bottom-up.

## Where the rules live

| Topic | File |
|---|---|
| The contract every server follows | `docs/CONTRACT.md` |
| Building a new service server | `docs/kit/SERVER-PLAYBOOK.md`; which servers, in what order: `docs/kit/SERVER-ROADMAP.md` |
| Starting a card session | `docs/SESSION-START.md` |
| Procedure and testing | `docs/PLAYBOOK.md` |
| Remaining acceptance | `docs/PLAN.md` |
| Designs | `docs/designs/BATCH-*.md` |
| Concrete helper, mapping and fixture recipes (read by unit) | `docs/implementation-contracts/IMPLEMENTATION-GUIDE.md` §1 |
| Current state and order | `docs/STATUS.md`, `docs/MASTER-ROADMAP.md`, `docs/pr-cards/work-index.json` |
| Owner decisions | `docs/OWNER-INPUTS.md` |
| Dated decisions | `docs/DECISIONS.md` |
| Ideas not being built | `docs/ROADMAP.md` |
| What Chris can ask for | `docs/OWNER-GUIDE.md` |
| Security constraints for PRs | `docs/AI-PR-READ-FIRST.md` |
| Runtime facts as built | `docs/ARCHITECTURE.md` |
| Audit of the old toolkit | `docs/audits/2026-10-10-old-toolkit.md` |

## Engineering rules

- **The hub never calls a service directly.** It talks only to servers' contract doors.
- **Every door enforces the same guards** because guards live in the servers; the hub adds its own pass checks and change
  log on top, never instead.
- **No secret leaves its home:** service keys stay in their server; passes are shown once and stored hashed (servers) or
  encrypted (the hub's stored passes for servers); the relay sees ciphertext on GitHub and plaintext only in memory.
- **Small results** (contract §7) through every door; the CLI's `--out` keeps big results out of an agent's context.
- **Additive database changes.** Node 24.x (Vercel stopped deploying Node 20 on 2026-10-01), plain ES modules, no build step for the CLI.

## How to run things

```bash
npm ci
npm run check                     # secrets, docs, index, lint
npm test                          # unit: tests/unit and every packages/<pkg>/test
npx vitest run packages/<pkg>/test
npm run test:db -- <file>         # throwaway localhost Postgres (CI's service, or a local cluster)
python3 docs/pr-cards/validate-index.py
```

`npm run test:conformance` is implemented by K-2 (reference fake server and real probes). Added later:
`npm run test:doors` (D-1, real CLI door tests against localhost fake servers; D-2 and D-3 add their own door checks).

## Ending a session

STATUS (merged, in progress with branch/PR/head/CI, blocked, next) · DECISIONS for decisions · ROADMAP for ideas ·
plain-English report to Chris: what changed, how it was verified, what he must decide, what is next.

## Development efficiency (K-3ar, PR #66)

Use [the focused implementation and CI recipes](docs/implementation-contracts/DEVELOPMENT-EFFICIENCY.md)
for approved work. Group cohesive, complete related capabilities (normally 450–800 production lines where
natural), while preserving the advisory size estimate, one risk area, reviewability and all hard gates.
Use `npm run test:focus -- <group>` only inside a slice; full check, unit, DB, immutable upstream source
CI and exact-head aggregate `ci` remain mandatory. Never split by endpoint merely to increase PR count.

## Daily release and build-cost policy (owner, 2026-10-12)

PRs target `main`. Follow [the daily release policy](.github/RELEASE-POLICY.md): only the daily scheduled job updates `live`; Vercel builds only `live`. Do not request or wait for a Vercel preview deployment, manually deploy production, or promote at a development batch boundary. Keep all existing local/Actions tests mandatory; this policy introduces no new application build/browser requirement where none existed. This newer owner instruction supersedes older batch/weekly release guidance.

## Verified hosting and main protections — October 12, 2026

Follow [the verified hosting-cost operating policy](docs/HOSTING-COST-POLICY.md). Saved exact-main protection requires GitHub Actions `ci` **and** `release-policy`; preserve existing review/agent merge flow, daily checked `main` → `live`, disabled automatic previews, low compute caps and all owner gates. Do not wait for Vercel preview checks or manually deploy at a batch boundary. Record this infrastructure checkpoint in the next substantive PR's status ledger; no documentation-only PR.
