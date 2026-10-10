# PLAN — remaining scope and acceptance

Written 2026-10-10 for an empty repository. Order: [MASTER-ROADMAP](MASTER-ROADMAP.md); state: [STATUS](STATUS.md).

## Rules that apply to every batch

- Every server stays fully usable on its own; nothing here becomes a dependency of a server.
- Every door passes the conformance and write-contract checks against the reference fake server.
- No secret in code, docs, tests, logs, PR text or results; passes shown once; relay sees only ciphertext on GitHub.
- No real pass or production/live account used from tests or scripts.
- Database changes additive; Node 20; plain English for Chris.

## Batch K — Contract, conformance, core, scaffold (`designs/BATCH-K.md`)
- [ ] CONTRACT RTC 1 final and agreed by both existing server plans; kit docs complete.
- [ ] `packages/conformance` with the reference fake server; each listed violation caught.
- [ ] `robinson-mcp-core` extracted from the Stripe MCP without behavior change; released as a pinned tarball.
- [ ] `rtool new-server` scaffolds a conforming empty server.

## Batch D — Direct doors (`designs/BATCH-D.md`)
- [ ] `rtool` CLI over several servers, SDK, skill, init; `rtool mcp` local MCP.
- [ ] GitHub relay: ciphertext only on GitHub, replay-safe, comments deleted.
- [ ] Real runs: a real server used from a local machine, a GitHub-only cloud workspace and a Vercel Sandbox, without the hub.

## Batch M — Old toolkit migration (`designs/BATCH-M.md`)
- [ ] Old toolkit frozen; read-only smoke test report with pass rates per namespace.
- [ ] Every namespace mapped in the server roadmap; `--legacy` bridge works; retirement checklist written.

## Batch H — Hub server (`designs/BATCH-H.md`)
- [ ] Hub is itself RTC 1 conformant; registered servers; federated search/describe/call/batch.
- [ ] Hub passes can only narrow server passes; hub change log; compact listing stays small with many servers.

## Batch C — Cross-server workflows (`designs/BATCH-C.md`)
- [ ] Plan → one confirm → run → ledger → undo-run; first ported workflows Chris asks for.

## Batch L — Local tools (`designs/BATCH-L.md`)
- [ ] Files/shell/git with folder allow-list and confirm; Ollama; browser.

## Batch S — Service servers (`designs/BATCH-S.md`)
- [ ] Each started server has its full plan in its own repo and appears in the roadmap; started only on Chris's request.
