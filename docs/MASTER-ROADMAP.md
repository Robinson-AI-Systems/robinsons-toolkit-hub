# MASTER ROADMAP — the one handoff

## Current Workspace integration acceptance — October 17, 2026 UTC

D-4 is complete for the independent Workspace RTC service: original separate local direct, GitHub-only encrypted relay and Vercel Sandbox direct runners passed; native audited Hub read, TEST/read-only refusal, same-pass issuer revocation and all temporary cleanup are verified. See [D-4](pr-cards/D-4.md) and [the exact sanitized receipt](audits/2026-10-17-d4-final-route-acceptance.json). Other Hub fleet/service, optional core publication and remaining roadmap obligations stay separately open in STATUS; this does not declare the whole Hub project complete.

The temporary relay is now disabled: webhook inactive, routing maps empty, issue closed/zero comments, disposable passes/token and ingress bypass revoked, Sandbox stopped. Existing hosted credentials and useful standing Hub grant are preserved. Activation for a new agent/service needs its own approved binding and scoped credentials; never reuse revoked test material. Workspace remains fully standalone and does not discover Hub.


Written 2026-10-10. [STATUS](STATUS.md) holds current state; [PLAN](PLAN.md) holds acceptance.

## The whole program (across repos)

Each server is usable on its own the moment it is built; the hub adds a single front door later.
The Hub is provider-agnostic; future provider families are owner-selected projects,
not a fixed Hub backlog or completion prerequisite. Each new provider agent uses
the original Toolkit read-only to reconcile its own intended capability coverage.
The original Toolkit is reference-only and is not maintained or rebuilt.

| Step | Where | What | Waits on |
|---|---|---|---|
| 1 | `stripe-mcp` | Batches A–C (contract code in `src/core/`) | — (ready now: card A-1) |
| 2 | `google-workspace-mcp` | Phase 8 P8-1 … P8-4 (small results, profiles, passes, HTTPS API) | Chris merging its plan PR |
| 3 | this repo | K-0 (foundation, **done**), K-1, K-2, K-2b (contract final, conformance + fake server) | — |
| 4 | this repo | D-1 … D-4 (`rtool`, local MCP, relay, real runs) | a server with its HTTPS API for D-4's real runs |
| 6 | `stripe-mcp` | D, G, H, P, W, U, R … | — |
| 7 | this repo | K-3 optional core; K-4 scaffold | existing K-3 release gates for package consumers only |
| 8 | new repos | S cards as Chris needs servers (Vercel, Neon, GitHub, messaging …) | Chris's request + empty repo |
| 9 | this repo | H-1 → H-2 → H-3 secure gateway, then H-4/H-5 and C | K-1/K-2/D-2 for implementation; two deployed scoped services for real acceptance |

## Order inside this repo

K-1/K-2 and D-2 are built. Next priority: H-1 → H-2 → H-3 with minimum grants/audit, then real two-service acceptance.
K-3 optional reuse and D-4 route proof continue independently; do not wait for all providers.
C follows accepted safe federation; L remains approved but does not displace eligible gateway work.
See [the recovery review](audits/2026-10-12-gateway-architecture-recovery.md); S cards only when Chris asks.

## Implementing agent — paste this

> Read `docs/SESSION-START.md`, STATUS and the next card (plus its resume note if present). Read the cited design and
> contract sections in bounded pieces. Run drift checklist A. If no card exists, write one short card from the approved
> design. Implement a coherent unit, run the targeted checks, push once. Fix blocking findings in one patch, write the
> self-review, merge when authorized and green. Update the card, STATUS and `work-index.json` as if merged. Continue
> while eligible work exists; stop only for a real gate, with committed work and the exact next action.

## Work coverage

| Batch | Cards | Card status |
|---|---|---|
| K Contract & core | K-0 foundation + proven CI (**merged**) · K-1 contract final + kit docs · K-2 conformance + fake server · K-2b refresh + two-instance checks · K-3 extract core (after Stripe C) · K-4 scaffold | K-0 [card](pr-cards/K-0.md); K-1 [card](pr-cards/K-1.md) and K-2 [card](pr-cards/K-2.md) READY; rest JIT |
| D Direct doors | D-1 `rtool` CLI · D-2 local MCP · D-3 GitHub relay · D-4 recipes + real runs | JIT |
| H Hub | H-1 foundation · H-2 registry · H-3 federation · H-4 narrowing passes · H-5 change log | JIT |
| C Workflows | C-1 engine · C-2 dev environment up/down (then ported workflows) · C-3 weekly digest | JIT |
| L Local | L-1 files/shell/git · L-2 Ollama · L-3 browser · L-4 guided settings runner | JIT |
| S Servers | S-vercel · S-neon · S-github (**done 2026-10-10**: plans + proven foundations in their repos) · S-messaging (more in `kit/SERVER-ROADMAP.md`) | written when Chris asks |
