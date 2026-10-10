# MASTER ROADMAP — the one handoff

Written 2026-10-10. [STATUS](STATUS.md) holds current state; [PLAN](PLAN.md) holds acceptance.

## The whole program (across repos)

Each server is usable on its own the moment it is built; the hub adds a single front door later.

| Step | Where | What | Waits on |
|---|---|---|---|
| 1 | `stripe-mcp` | Batches A–C (contract code in `src/core/`) | — (ready now: card A-1) |
| 2 | `google-workspace-mcp` | Phase 8 P8-1 … P8-4 (small results, profiles, passes, HTTPS API) | Chris merging its plan PR |
| 3 | this repo | K-1, K-2 (contract final, conformance + fake server) | — |
| 4 | this repo | D-1 … D-4 (`rtool`, local MCP, relay, real runs) | a server with its HTTPS API for D-4's real runs |
| 5 | this repo | M-1, M-2 (freeze + smoke test of the old toolkit) | Chris running the smoke test on his machine |
| 6 | `stripe-mcp` | D, G, H, P, W, U, R … | — |
| 7 | this repo | K-3, K-4 (shared core, scaffold) | Stripe A–C merged |
| 8 | new repos | S cards as Chris needs servers (Vercel, Neon, GitHub, messaging …) | Chris's request + empty repo |
| 9 | this repo | H (hub), C (workflows), L (local tools), M-3/M-4 | two servers conformant |

## Order inside this repo

K → D → M → H → C → L, with S cards whenever Chris asks for a server.

## Implementing agent — paste this

> Read `docs/SESSION-START.md`, STATUS and the next card (plus its resume note if present). Read the cited design and
> contract sections in bounded pieces. Run drift checklist A. If no card exists, write one short card from the approved
> design. Implement a coherent unit, run the targeted checks, push once. Fix blocking findings in one patch, write the
> self-review, merge when authorized and green. Update the card, STATUS and `work-index.json` as if merged. Continue
> while eligible work exists; stop only for a real gate, with committed work and the exact next action.

## Work coverage

| Batch | Cards | Card status |
|---|---|---|
| K Contract & core | K-1 contract final + kit docs · K-2 conformance + fake server · K-3 extract core (after Stripe C) · K-4 scaffold | K-1 [card](pr-cards/K-1.md); rest JIT |
| D Direct doors | D-1 `rtool` CLI · D-2 local MCP · D-3 GitHub relay · D-4 recipes + real runs | JIT |
| M Migration | M-1 freeze + smoke test · M-2 namespace map · M-3 legacy bridge · M-4 retirement checklist | JIT |
| H Hub | H-1 foundation · H-2 registry · H-3 federation · H-4 narrowing passes · H-5 change log | JIT |
| C Workflows | C-1 engine · C-2 dev environment up/down (then ported workflows) · C-3 weekly digest | JIT |
| L Local | L-1 files/shell/git · L-2 Ollama · L-3 browser | JIT |
| S Servers | S-vercel · S-neon · S-github · S-messaging (more in `kit/SERVER-ROADMAP.md`) | written when Chris asks |
