# Design — Batch K: Contract, conformance test, shared core, server scaffold

Status: **APPROVED** (Chris, 2026-10-10: one server per toolset, combined later by Robinson's Toolkit). Scope and
acceptance: `docs/PLAN.md` → Batch K. Cards K-1 … K-4.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| K1 | `docs/CONTRACT.md` is RTC 1 and both existing server plans cite it | `grep -n "RTC 1" docs/CONTRACT.md`; Stripe `docs/designs/BATCH-R.md`; Workspace `docs/plan/TASKS.md` Phase 8 |
| K2 | (K-3 only) Stripe MCP has merged Batches A–C with contract code under `src/core/` and a grep test that it imports nothing Stripe-specific | Stripe `docs/STATUS.md`; `grep -rn "from '../stripe\|from 'stripe'" src/core \| head` |

## 1. Decisions

**K1. The contract is versioned and lives only here.** A change is RTC n+1, a dated DECISIONS entry, and an adoption
card in each server. The hub supports every RTC version a registered server declares, or refuses it with a plain
message.

**K2. The conformance test is a package** (`packages/conformance`), runnable two ways: `npx github:Robinson-AI-Systems/
robinsons-toolkit-hub#conformance-v1 <server-url> --pass-env RTC_PASS` against a running server (the server provides a test
pass in its test/sandbox mode), and as a library inside a server's own CI against a locally started server. It includes a
**reference fake server** (`packages/conformance/fake-server`) implementing RTC 1 with in-memory tools (one read, one
write, one destructive, one money tool), used by this repo's door tests.

**K3. `robinson-mcp-core` is extracted, not designed from scratch.** The Stripe MCP writes its contract-generic code in
`src/core/` (its Batch A amendment). K-3 moves that code here as `packages/core`, keeps its tests, and publishes it as a
GitHub Release tarball (`robinson-mcp-core-<semver>.tgz`) that servers pin by URL — no npm account needed. Stripe and
Workspace adopt it with their own cards (Stripe: a card after Batch C; Workspace: P8-6).

**K4. New servers start from a scaffold.** `rtool new-server <name>` (K-4) creates the standard layout, copies the plan
system (`docs/kit/templates/`), wires `robinson-mcp-core`, and writes the first card. A new server is otherwise built by
following `docs/kit/SERVER-PLAYBOOK.md`.

## 4. Work units

### K-1 — Contract v1 final, kit docs (S, docs)
Files: `docs/CONTRACT.md` (review wording against both server plans), `docs/kit/SERVER-PLAYBOOK.md`,
`docs/kit/SERVER-ROADMAP.md`. Done when: both server plans and this file agree; validator green.
### K-2 — Conformance package and reference fake server (L, medium effort)
Tests: the fake server passes; deliberately broken fakes (missing manifest, write without dryRun, read-only pass that can
write, key-shaped string in a result, oversize result without handle) each fail with a plain message.
### K-3 — Extract `robinson-mcp-core` (L, medium effort) — after Stripe C
Done when: Stripe's `src/core/` tests pass unchanged inside `packages/core`; a Release tarball exists; an adoption card
text is handed to the Stripe and Workspace repos (not executed here).
### K-4 — Server scaffold `rtool new-server` (M)
Done when: a scaffolded repo passes its own `npm run check` and conformance against its empty registry.

## 5. Stop-and-ask points
1. K2 false: K-3 waits; K-1, K-2, K-4 (with copied code) proceed.

## 6. Acceptance mapping

| PLAN Batch K line | Evidence |
|---|---|
| Conformance catches each violation | `packages/conformance/test/negative.test.js` |
| Core extracted without behavior change | Stripe core tests passing in `packages/core` |
| Scaffold produces a conforming empty server | K-4 PR output |

## Amendments
