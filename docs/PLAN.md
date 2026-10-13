# PLAN — remaining scope and acceptance

Written 2026-10-10 for an empty repository. Order: [MASTER-ROADMAP](MASTER-ROADMAP.md); state: [STATUS](STATUS.md).

## Rules that apply to every batch

- Every server stays fully usable on its own; nothing here becomes a dependency of a server.
- Every door passes the conformance and write-contract checks against the reference fake server.
- No secret in code, docs, tests, logs, PR text or results; passes shown once; relay sees only ciphertext on GitHub.
- No real pass or production/live account used from tests or scripts.
- Database changes additive; Node 24.x; plain English for Chris.

## Batch K — Contract, conformance, core, scaffold (`designs/BATCH-K.md`)
- [ ] CONTRACT RTC 1 final and agreed by both existing server plans; kit docs complete.
- [ ] `packages/conformance` with the reference fake server; each listed violation caught.
- [ ] Optional `robinson-mcp-core` reusable exports proven and released under existing gates; service adoption separate. This line does not gate H or D-4.
- [ ] `rtool new-server` scaffolds a conforming empty server.

## Batch D — Direct doors (`designs/BATCH-D.md`)
- [ ] `rtool` CLI over several servers, SDK, skill, init; `rtool mcp` local MCP.
- [ ] GitHub relay: ciphertext only on GitHub, replay-safe, comments deleted.
- [ ] Real runs: a real server used from a local machine, a GitHub-only cloud workspace and a Vercel Sandbox, without the hub.

## Batch H — Hub server (`designs/BATCH-H.md`)
- [ ] Hub is itself RTC 1 conformant; registered servers; federated search/describe/call/batch.
- [ ] Hub passes can only narrow server passes; hub change log; compact listing stays small with many servers.

## Batch C — Cross-server workflows (`designs/BATCH-C.md`)
- [ ] Plan → one confirm → run → ledger → undo-run; first ported workflows Chris asks for.

## Batch L — Local tools (`designs/BATCH-L.md`)
- [ ] Files/shell/git with folder allow-list and confirm; Ollama; browser.
- [ ] Guided settings runner: structured steps in a visible browser, each approved, never typing credentials, verified by read-back.

## Batch S — Service servers (`designs/BATCH-S.md`)
- [ ] Each started server has its full plan in its own repo and appears in the roadmap; started only on Chris's request.

## Gateway recovery acceptance — owner request 2026-10-12

Use [the finite recovery matrix](audits/2026-10-12-gateway-architecture-recovery.md) and H-1/H-2/H-3 cards.
- [ ] Fixed agent-facing tool count/schema and <5,000 measured tokens at 100 services/10k underlying tools.
- [ ] No eager provider-schema loading; bounded queues, scoped cache/results, timeouts and partial failures.
- [ ] Caller grant narrowing and durable correlation audit before first federated execution.
- [ ] Two independent services used through one actual agent MCP connection; each still works directly.
- [ ] Genuine harmless TEST reads, denial and same-pass revocation; source/fake/deployed proof kept separate.
Full fleet, package publication and optional adoption are separate acceptance, not prerequisite proof.
