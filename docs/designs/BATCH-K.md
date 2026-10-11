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
Files: `docs/CONTRACT.md` (review wording against both server plans; confirm no server serves `GET /api/contract` with
`rtc: 1` before the freeze — after it, every change is a new version), `docs/kit/SERVER-PLAYBOOK.md`,
`docs/kit/SERVER-ROADMAP.md`. Done when: both server plans and this file agree; validator green.
### K-2 — Conformance package and reference fake server (L, medium effort)
Tests: the fake server passes; deliberately broken fakes (missing manifest, write without dryRun, read-only pass that can
write, key-shaped string in a result, oversize result without handle, a refresh that drops connection settings, a rate
limit kept in memory so two instances each allow the full limit) each fail with a plain message. The runner can start a
server command twice against one throwaway database and split calls between the two processes (`--instances 2`); the
in-memory fake must fail that check every run, not by chance.
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

**2026-10-10 — K-0 and the K-2 split (Claude, drift check A for the first code card).**
1. *K-0 Repository foundation and proven CI* is added before K-2. The plan had no card that creates the repository's
   code foundation (the servers have A-1 for this). K-0 adds `package.json` (Node 24.x, npm workspaces `packages/*`,
   exact versions, committed lockfile), the checks (`npm run check`: secret scan with hub rules, docs check, index
   validation, lint), the unit and throwaway-Postgres harnesses, and CI with one aggregate `ci` gate, copied from the
   newest proven server foundation (`neon-mcp` @ `d396fb4`). K-1 (docs only) does not depend on it; K-2 does.
2. *K-2 is split in two* to respect the 500-line PR budget: **K-2** builds the package, the reference fake server and
   every HTTPS-tool-API check with its deliberately broken fakes; **K-2b** adds the two checks that need extra
   machinery — a refreshed connector token keeps its settings (the fake gains a minimal OAuth door) and the
   `--instances 2` rate-limit check (two server processes on one throwaway database; the in-memory fake must fail it
   every run and a database-backed fake mode must pass it, so the check is proven both ways). K-2b also tags
   `conformance-v1`. K-4 depends on K-2b. Acceptance mapping unchanged (`negative.test.js` spans both).
3. The conformance runner receives the read-only, expired and revoked passes it needs from environment variables named
   on its command line; a check whose pass was not supplied is reported `skipped`, never ok (K-1 confirms in CONTRACT §9).

**2026-10-11 — K-3 extraction boundary reconciliation (drift A; Stripe main 09ed53a).**
K2's entire-folder portability assumption is false despite A–C cards being MERGED:
`src/core/profiles.js`, `write.js`, `oauth-handlers.js`, `mcp-auth.js`,
`mcp-server.js` and `one-time-secrets.js` embed account, mode, provider,
AAD, or transitive service semantics. Extract in reviewed, source-compatible
slices K-3a (OAuth/crypto), K-3b (registry/HTTP/write-declaration checker),
then remaining semantic adapters and packaging/proof. All K-3 acceptance stays
open until full contract-generic exports and clean-consumer tarball test are
complete and a GitHub Release asset actually exists. No default policy or RTC
version changes; Stripe and Workspace adoption remain separate repo-owned cards.
