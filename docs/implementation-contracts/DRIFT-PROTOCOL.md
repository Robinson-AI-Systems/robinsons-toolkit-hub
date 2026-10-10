# Drift and reconciliation — start of every PR, end of every PR, end of every batch

Code moves while plans sit still. This is how the implementing model keeps plan, cards and code in agreement without
stopping for a planning session. Copied in shape from Appliance Desk's protocol (2026-10-09). Three checklists:
**A** before coding each PR, **B** inside each PR (written as if merged), **C** when a batch finishes.

This repo has two extra sources of drift: **the service servers** (each moves at its own pace; the hub must work with
whatever RTC version each declares in `GET /api/contract`) and **the contract itself** (`docs/CONTRACT.md`).

| Kind | Example | Do this |
|---|---|---|
| Mechanical | file moved, helper renamed, fixture changed | adapt in this PR, correct the card, run the regression |
| Already delivered | the card's tool exists with a passing write-contract test | remove it from the card, cite the PR/test |
| Compatible extension | a server added tools or areas | nothing to do; the hub reads them from the server |
| Server semantic | a server behaves differently from the contract | don't work around it; record it, card in that server's repo, continue other work |
| Semantic (ours) | different money rule, guard behavior, key handling, pass permissions, lock order | dated amendment, reviewed in the current PR before coding that slice |
| Owner-only | live mode, buying, a default that changes money limits | keep the gate and its `IN-xx`; never pretend it is done |

## A. Start of every PR (one bounded pass, ~10 minutes)

1. Record: current `main` SHA, the predecessor's merged SHA, the card's "Baseline inspected" SHA.
2. Read the predecessor PR's description (dispositions, carried findings) and the resume note if present.
3. `git diff --name-status <card-baseline>..origin/main -- <card's paths> | head -50`; read each changed function the
   card relies on (≤150 lines).
4. For each server the card relies on: read its `GET /api/contract` (or its plan if not built yet) and confirm the RTC
   version and doors the card assumes.
5. Write the table in the PR description, then fix the card before coding:

| Card assumption | Actual at `main` / in the server's contract manifest | Kind | Card correction / test |
|---|---|---|---|

## B. End of every PR (inside the same PR, written as if it had already merged)

CI enforces the minimum (`scripts/check-docs-updated.mjs`): a PR that changes `api/`, `src/` or `packages/` must also
change `docs/STATUS.md` and its card or `work-index.json`, and `docs/CONTRACT.md` + `docs/DECISIONS.md` together when the
contract changes —
unless the PR description says "Docs-update: not needed — <reason>".

1. The card says `MERGED (#n)`; anything split off names its new owner card.
2. Successor card updated (baseline, changed paths/signatures, carried low-risk findings). If it is JIT, put the same
   facts in `docs/designs/CHANGES-SINCE-DESIGN.md`.
3. Living docs: ARCHITECTURE (tables, env vars, endpoints), OWNER-INPUTS (new question or applied answer), OWNER-GUIDE
   (something Chris can now ask for), `docs/kit/SERVER-ROADMAP.md` (a server's status changed).
4. Queue: STATUS says this merged and names the next card; `work-index.json` status updated; delete the resume note.

## C. End of every batch (one small docs PR)

1. Every PLAN acceptance item for the batch checked with evidence; anything unproved stays open with an owner card.
2. Living docs match the code.
3. Retire what no longer instructs anyone (`git mv` to `docs/archive/<folder>/`, RETIRED banner at the top, update
   references, one row in `docs/archive/README.md`, one DECISIONS entry).
4. Run the next batch design's "0. Verify before starting" table against today's code and servers; amend or record
   "no drift" in STATUS; write the next batch's first card.
5. MASTER-ROADMAP, `work-index.json`, STATUS, one DECISIONS entry; tell Chris in plain English.

## Planning while a card is being built

A planning or docs PR that lands while a card is in progress does not edit that card's file, status lines or
`work-index.json` entry; it adds its own sections and says which in-flight card it affects. The implementer reconciles
once, at the PR boundary, by merging `main`.
