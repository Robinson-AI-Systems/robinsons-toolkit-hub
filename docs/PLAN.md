# PLAN — remaining scope and acceptance

## Current Workspace integration acceptance — October 17, 2026 UTC

D-4 is complete for the independent Workspace RTC service: original separate local direct, GitHub-only encrypted relay and Vercel Sandbox direct runners passed; native audited Hub read, TEST/read-only refusal, same-pass issuer revocation and all temporary cleanup are verified. See [D-4](pr-cards/D-4.md) and [the exact sanitized receipt](audits/2026-10-17-d4-final-route-acceptance.json). Other Hub fleet/service, optional core publication and remaining roadmap obligations stay separately open in STATUS; this does not declare the whole Hub project complete.

The temporary relay is now disabled: webhook inactive, routing maps empty, issue closed/zero comments, disposable passes/token and ingress bypass revoked, Sandbox stopped. Existing hosted credentials and useful standing Hub grant are preserved. Activation for a new agent/service needs its own approved binding and scoped credentials; never reuse revoked test material. Workspace remains fully standalone and does not discover Hub.


Written 2026-10-10 for an empty repository. Order: [MASTER-ROADMAP](MASTER-ROADMAP.md); state: [STATUS](STATUS.md).

## Rules that apply to every batch

- Every server stays fully usable on its own; nothing here becomes a dependency of a server.
- Every door passes the conformance and write-contract checks against the reference fake server.
- No secret in code, docs, tests, logs, PR text or results; passes shown once; relay sees only ciphertext on GitHub.
- No real pass or production/live account used from tests or scripts.
- Database changes additive; Node 24.x; plain English for Chris.

## Batch K — Contract, conformance, core, scaffold (`designs/BATCH-K.md`)
- [x] CONTRACT RTC 1 and kit documentation implemented (K-1 merged); genuine per-service acceptance remains separately tracked.
- [x] `packages/conformance` with reference fake server and violation tests (K-2/K-2b merged).
- [ ] Optional `robinson-mcp-core` reusable exports proven and released under existing gates; service adoption separate. This line does not gate H or D-4.
- [ ] `rtool new-server` scaffolds a conforming empty server.

## Batch D — Direct doors (`designs/BATCH-D.md`)
- [x] `rtool` CLI, SDK, skill, init and local MCP implemented and tested (D-1/D-2 merged).
- [x] GitHub encrypted relay/replay guards implemented; actual Workspace ciphertext roundtrip and zero-comment cleanup verified.
- [x] Actual independent Workspace service passed original local direct, GitHub-only encrypted relay and Vercel Sandbox direct runners, plus same-pass revocation/cleanup (D-4, PR227).

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
