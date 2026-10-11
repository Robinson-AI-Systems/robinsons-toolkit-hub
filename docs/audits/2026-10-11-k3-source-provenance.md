# K-3 frozen source provenance — 2026-10-11

Inspected `Robinson-AI-Systems/stripe-mcp` main `60877ae0058262c09bbbe7bd48970dc1aca6334c`. Compared from the earlier K-3 baseline `dca5ad81c5c0982cadae4735c29a78d2c1a5f8b2`: twelve commits advanced G tool work and documentation; no tracked `src/core` changes. Read-only inspection only; never modify the source server from this repository.

## Machine-verifiable extraction boundary

`K3-SOURCE-TRACE.json` records the exact upstream Git blob and local core Git blob per public subpath, plus real core tests and explicit service-owned boundaries. `npm run check` validates local blob hashes, export completeness and per-module test presence, and **refuses a complete-release status**. These hashes are provenance, not a claim that modified adapter functions are equivalent to every upstream execution case.

- Byte-identical source: `oauth`, `crypto`, `registry`, `http`, `write-contract-check` (5 of 11).
- Explicitly adapted source: `profiles` (service-mode and test-area rules), `mcp-auth` (token/account claims), `one-time-secrets` (AAD and SQL row), `oauth-protocol` (owner UI, OAuth claims, refresh SQL), `write` (money and retry guards), `mcp-dispatch` (MCP SDK transport/redaction/results). No source server was modified.
- Local unit/integration tests and throwaway Postgres verify selected portable seams. They do **not** replace the source Stripe unit, mock or database suites; a server must execute those with its adoption card and prove behavior before switching imports.

## Release and adoption gates still open

K-3 **IN_PROGRESS**. Before any release, reconcile every adapted interface with source assertion bodies, source-provided errors/refusals, SQL owners and client imports. Prove exact pack contents and clean standalone consumer again at candidate version. Verify no provider dependency, live credentials or default policy widening. Only then make a real versioned GitHub Release asset with pinned checksum and documented artifact URL, not a workflow alone. This repository writes proposed Stripe and Workspace adoption instructions; each service builds and verifies under its own rules. D-4 owner-run tests remain separate.

The manifest does not automatically fetch GitHub during CI, so at the next PR boundary recheck upstream main and compare `src/core` drift. Any local hash update must carry explicit source-delta explanation, tests and a reviewed PR. Never refresh a digest just to turn CI green.
