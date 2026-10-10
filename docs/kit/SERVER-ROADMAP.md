# Server roadmap — every service, its future home, and the order

Updated 2026-10-10. Every namespace of the old `robinsons-toolkit-mcp` (3,049 tools) has a home below. Servers are started
**when Chris needs them** (Batch S card), not in a fixed schedule; the "Suggested order" follows what his projects use
today (Appliance Desk first). "Old tools" are the old toolkit's counts; "pass rate" fills in from the Batch M smoke test.

## Service servers

| Suggested order | Server (repo) | Covers old namespaces (old tools) | Why / who uses it | Status |
|---|---|---|---|---|
| 1 | Google Workspace MCP (`google-workspace-mcp`) | `google` (158) | Appliance Desk email, calendar, Drive; business admin | **Live** (360 tools); contract upgrade = its Phase 8 |
| 2 | Stripe MCP (`stripe-mcp`) | `stripe` (202) | Appliance Desk billing; future SaaS billing | **Planned, approved**; contract = its Batch R |
| 3 | Vercel MCP (`vercel-mcp`) | `vercel` (181) | Hosting for every app; DNS for Workspace domains | Not started |
| 4 | Neon MCP (`neon-mcp`) | `neon` (204) | Databases for every app (branches, restores, SQL with guards) | Not started |
| 5 | GitHub MCP (`github-mcp`) | `github` (311) | Every repo, PRs, CI, releases; the relay | Not started |
| 6 | Messaging MCP (`messaging-mcp`) | `resend` (52), `twilio` (115) | Customer email and SMS for Appliance Desk and YardSync; one server, two areas, strict "messages to people" guard | Not started |
| 7 | Sentry MCP (`sentry-mcp`) | `sentry` (104) | Errors and performance across apps | Not started |
| 8 | Cloudflare MCP (`cloudflare-mcp`) | `cloudflare` (187) | DNS/CDN/Workers if a project moves there | Not started |
| 9 | Clerk MCP (`clerk-mcp`) | `clerk` (102) | Auth for YardSync/Cortiware if chosen | Not started |
| 10 | Supabase MCP (`supabase-mcp`) | `supabase` (127) | Only if a project uses Supabase | Not started |
| 11 | AI providers MCP (`ai-providers-mcp`) | `openai` (133), `anthropic` (64), `gemini` (31), `moonshot` (17), `voyage` (11) | Usage, keys, models, batch jobs across AI vendors; admin keys separate from app keys | Not started |
| 12 | Data stores MCP (`data-mcp`) | `upstash` (197), `qdrant` (71), `postgres` (111) | Redis, vectors, any Postgres by connection string (production guard on SQL writes) | Not started |
| 13 | Work tools MCP (`work-mcp`) | `linear` (64), `slack` (69), `n8n` (79) | Issues, chat, automations | Not started |
| 14 | Mapbox MCP (`mapbox-mcp`) | `mapbox` (51) | YardSync routing, geocoding | Not started |
| 15 | Research MCP (`research-mcp`) | `search` (30), `context7` (45), `sam` (21) | Web search, docs lookup, SAM.gov federal contracts (YardSync) | Not started |
| 16 | Fly MCP (`fly-mcp`) | `fly` (116) | Only if a project runs on Fly.io | Not started |

Grouping rule: one server per large service; small services that share a purpose and a risk type share a server (each
keeps its own credentials and area). Any group can be split later without changing tool names (they are prefixed by area).

## Hub-native (this repo)

| Old namespace (old tools) | New home |
|---|---|
| `compound` (46) | Hub cross-server workflows (Batch C), ported only when their servers exist and Chris wants them |
| `local` (87) | `rtool mcp` local tools (Batch L-1) |
| `ollama` (16) | `rtool mcp` local tools (L-2) |
| `playwright` (47) | `rtool mcp` local browser (L-3) |

## Until a server exists

The old toolkit keeps working locally (frozen), and `rtool mcp --legacy` (Batch M-3) can expose it under `legacy.*` so
agents can still reach a namespace with no new server yet.
