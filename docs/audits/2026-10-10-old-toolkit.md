# Audit: the old Robinson's Toolkit MCP (2026-10-10)

Reference evidence, not instructions. Source: `Robinson-AI-Systems/robinsons-toolkit-mcp` `main` as of 2026-09-28.

## Facts

- **Size:** 3,049 tools in `registry/*.json` across 31 namespaces (largest: github 311, neon 204, stripe 202, upstash 197,
  cloudflare 187, vercel 181, google 158, openai 133, supabase 127, fly 116, twilio 115, postgres 111, sentry 104,
  clerk 102).
- **Discovery is already lazy:** the server lists 4 meta-tools (`search_toolkit`, `list_namespaces`, `get_tool_schema`,
  `execute_tool`) plus ~15 pinned tools; everything else is found by keyword search (`index.js`). So context size is not
  the main problem.
- **No tool is actually exercised by tests.** `test-toolkit.js` checks only that environment variables are set, and marks
  local, file, shell and Playwright tools as passing without calling them. `TEST_RESULTS.md` ("All Tools Functional") is
  based on that script. `audit.js` checks that registry names match handler code, not that calls work.
- **Real breakage found where checked (Stripe):** calls to endpoints Stripe removed in 2025, an encoder that sends lists
  of objects as `[object Object]`, wrong "cancel at period end", miscomputed revenue figures, no confirmation on 35
  destructive or money tools. Full list: `Robinson-AI-Systems/stripe-mcp` `docs/audits/2026-10-10-existing-stripe-code.md`.
  No service API version is pinned, so other namespaces are likely to have similar drift.
- **Runs only locally** (WSL), one process holding ~50 service keys; not reachable from claude.ai, phones or cloud agents.

## What is worth keeping

The search-then-call design; cross-service compound tools (tenant provisioning, YardSync job close-out, reports); local
file/shell tools, Ollama and Playwright; SAM.gov; the rollback-ledger idea. All have a home in this repo or a future server
(`docs/kit/SERVER-ROADMAP.md`).
