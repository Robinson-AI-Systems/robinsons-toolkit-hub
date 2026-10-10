# Design — Batch L: Local tools (files, shell, git, Ollama, browser)

Status: **APPROVED** (Chris, 2026-10-10). Scope: `docs/PLAN.md` → Batch L. Cards L-1 … L-3. Depends on D-2.

A hosted server cannot reach Chris's computer, so the old toolkit's `local`, `ollama` and `playwright` namespaces move
into `rtool mcp` (the local MCP), running on the machine where they act.

## 1. Decisions

**L1. Local tools exist only in `rtool mcp`**, never in the hosted hub or relay. They are listed under the `local.*`
prefix and are off unless `rtool mcp --local <folder>[,<folder>]` names the allowed folders.
**L2. Shell commands** run only inside allowed folders, with a timeout, an output cap, and `confirm: true` for anything
outside a small read-only allow-list (`ls`, `cat`, `git status`, `git diff`, `git log`). No `sudo`.
**L3. Ollama** (`local.ollama_*`) talks to `OLLAMA_BASE_URL` only. **Playwright** (`local.browser_*`) runs headless,
allowed hosts configurable, screenshots saved to files (paths returned, not bytes).
**L4. Port, don't copy:** the old toolkit's handlers are the reminder of what existed; each tool is rebuilt with tests.

## 4. Work units
### L-1 — Files, shell, git (M, medium effort)
Tests: path escape refused; command outside allow-list needs confirm; timeout and output cap.
### L-2 — Ollama (S)
### L-3 — Browser (M)

## Amendments
