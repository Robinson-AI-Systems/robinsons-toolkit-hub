# Design — Batch M: Migrating the old toolkit

Status: **APPROVED** (Chris, 2026-10-10). Scope: `docs/PLAN.md` → Batch M. Cards M-1 … M-4.

The old `robinsons-toolkit-mcp` (3,049 tools, 31 namespaces, local only) keeps working for Chris until each part has a
better home. Audit: `docs/audits/2026-10-10-old-toolkit.md`.

## 1. Decisions

**M1. Freeze now.** No new tools in the old repo (a note in its `CLAUDE.md`, card M-1, executed there with Chris's OK).
Bug fixes only when Chris hits one.
**M2. Measure before deciding.** A read-only smoke test (M-1) calls every read tool of the old toolkit with minimal
arguments on Chris's machine (his keys stay there) and writes a pass/fail report. Each namespace's real pass rate goes
into `docs/kit/SERVER-ROADMAP.md`.
**M3. Map every namespace** to its future home (a service server, hub workflows, local tools, or retire) — M-2, recorded in
the roadmap.
**M4. Bridge while migrating:** `rtool mcp --legacy` can start the old toolkit as a local child process and list its tools
under `legacy.*`, clearly labelled, so an agent can still reach a namespace whose new server doesn't exist yet. Legacy
tools get no hub guarantees and say so.
**M5. Retire per namespace** when its replacement passes conformance; retire the repo (archive on GitHub, Chris's click)
when nothing is left.

## 4. Work units
### M-1 — Freeze note and read-only smoke test of the old toolkit (M)
### M-2 — Namespace map and pass rates into the roadmap (S, docs)
### M-3 — `--legacy` bridge in `rtool mcp` (M)
### M-4 — Retirement checklist (S, docs)

## Amendments
