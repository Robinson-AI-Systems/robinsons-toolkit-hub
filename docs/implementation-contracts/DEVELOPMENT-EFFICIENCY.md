# Evidence-based development efficiency — K-3ar / PR #66

Authority remains AGENTS, SESSION-START, PLAYBOOK, cards, drift protocol and K-3 release gates.
This document is a **navigation and executable recipe**, never an exception to those authorities.

## Bottleneck evidence at dc6441c (2026-10-11)

- Recent PRs #61–#65 each landed one narrowly scoped K-3 test/hardening slice, requiring another exact-head CI
  and post-merge run each time. Group independent, related tests/fixtures and low-risk implementation in complete
  coherent PRs when the same risk area and service boundary allow it. Do not pad changes.
- `verify-k3-upstream-drift.mjs` and `verify-k3-remote-release.mjs` each independently implemented JSON
  evidence HTTP and error normalization. `scripts/github-evidence-json.mjs` now owns that deterministic,
  read-only, no-secret common path, tested adversarially. Provider-specific release/drift gates remain separate.
- Standard CI intentionally runs `check`, `unit`, disposable `db`, immutable Stripe source SQL and immutable
  Stripe owner HTTP before aggregate `ci`. It installs separate dependencies for job isolation. Never eliminate
  source SQL/owner jobs or weaken aggregate `ci` just to reduce minutes; avoid extra pushes instead.
- Before this PR, repeatable K-3 focused command selection required manual file discovery. The checked-in
  `test:focus` recipe provides five bounded selectors with no dynamic shell, a dry list mode and targeted tests.

## High-signal workflow and test commands

| Work | Existing code, source boundary and tests | During the slice | Final evidence |
|---|---|---|---|
| Current Stripe source drift | `scripts/verify-k3-upstream-drift.mjs`; pinned `K3-UPSTREAM-BASELINE.json`; `tests/unit/k3-upstream-drift.test.js` | `npm run test:focus -- upstream`; inspect current Stripe tree/changed original suites | Real read-only upstream head SHA; updated reviewed blobs only after diff, original assertions retained |
| HTTP/OAuth/bearer adapters | `packages/core/src/{http,mcp-auth,oauth-protocol,one-time-secrets}.js`; source-authentic differential tests | `npm run test:focus -- auth adapter` | Refuse malformed token, account leak, replay and owner-policy bypass; original source boundary remains service owned |
| Dispatch/guarded writes | `packages/core/src/{mcp-dispatch,write}.js`; corresponding source differential and write safety suites | `npm run test:focus -- adapter core` | Explicit writes metadata, TEST-only guard, audited denied mutations; source owner independently approves money out |
| Release evidence and ledger | `scripts/{check-k3-release-gates,verify-k3-remote-release}.mjs` and matching tests | `npm run test:focus -- release` | Private core, NOT_READY, no fabricated remote tag or artifact evidence |
| PostgreSQL/service SQL | `tests/db` disposable fixtures; immutable upstream SQL CI job | Targeted `npm run test:db` using throwaway DB only | Required local DB and authentic source SQL/HTTP CI at exact PR head |

`npm run test:focus -- upstream --list` prints file selectors without running tests. The dry-list
and unknown-group guards are separately unit tested. Only `check`, `unit`, `db` and source SQL/HTTP plus the
aggregate `ci` are merge proof; focused green alone is not.

## Single-card implementation packet, used for each next PR

1. Pin exact hub main and Stripe current main. Record changed paths (including upstream test-only drift),
   previous review dispositions and any owner-dependent gate. Identify the **existing** helper and fixture above.
2. Choose a cohesive slice bounded by one risk model, with input → injected service/DB interface → output/error,
   and explicit forbidden side effects. Keep upstream original assertion bodies independently checked.
3. Implement related functionality + adversarial tests. Use fixed focused group(s) between slices, not a full
   CI push per endpoint. Do not rewrite an immutable upstream snapshot to match portable behavior.
4. Validate full `npm run check`, `npm test`, targeted throwaway `npm run test:db` as appropriate; push once
   per completed CI cycle. In REST-only environments make a draft PR and use each exact-head CI run for slices.
5. Self-review whole diff against AI-PR-READ-FIRST, reconcile source drift, address/resolve every thread,
   write STATUS/card evidence, and merge only with green exact-head aggregate `ci`.

## Measurements and handoff

Baseline: two scripts maintained separate JSON evidence fetching (now one tested helper); five PRs #61–#65
created five distinct CI merge boundaries (mandatory and appropriate for their scope). New scoped groups: five;
upstream/remote evidence helpers that duplicate the JSON request: 2 → 0; source CI jobs removed: **0**.
Capture each successor's number of exact-head runs, retries, actual merged capabilities and changed original
source/test blobs in its PR. The benefits must be measured from GitHub, not invented locally.
