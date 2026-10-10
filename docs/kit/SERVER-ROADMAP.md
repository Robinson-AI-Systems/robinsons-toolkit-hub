# Server roadmap — every service, its future home, and the order

Updated 2026-10-10. Every service the old toolkits covered has a planned server below (as a completeness checklist only). Servers are started
**when Chris needs them** (Batch S card), not in a fixed schedule; the "Suggested order" follows the services his
current work touches most (any project); it is not a limit — unplanned services are added the same way. "Old tools" are the old toolkit's counts, for the gap check.

## Service servers

| Suggested order | Server (repo) | Covers old namespaces (old tools) | What it's for (build, own and operate) | Status |
|---|---|---|---|---|
| 1 | Google Workspace MCP (`google-workspace-mcp`) | `google` (158) | Mail, calendar, Drive, Docs/Sheets, admin; build-time: test fixtures, app integration checks (its P8-7) | **Live** (360 tools); contract upgrade = its Phase 8 |
| 2 | Stripe MCP (`stripe-mcp`) | `stripe` (202) | Payments and billing for anything; build-time: test data, cleanup, test events, signed forwarding, time travel (its Batch V) | **Planned, approved**; contract = its Batch R |
| 3 | Vercel MCP (`vercel-mcp`) | `vercel` (181) | Projects, deployments, env vars, domains, DNS, logs; build-time: preview deploys per branch, env wiring, rollback, log tail for a feature | **Planned + foundation merged** (236 tools; repo `Robinson-AI-Systems/vercel-mcp`, next card A-2) |
| 4 | Neon MCP (`neon-mcp`) | `neon` (204) | Projects, branches, SQL with production guard, restores; build-time: a throwaway branch per feature or test run, schema diff, seed and reset | **Planned + foundation merged** (177 tools; repo `Robinson-AI-Systems/neon-mcp`, next card A-2) |
| 5 | GitHub MCP (`github-mcp`) | `github` (311) | Repos, branches, PRs, reviews, CI, releases, issues; build-time: scratch repos, CI reruns and logs, release cutting | **Planned + foundation merged** (305 tools; repo `Robinson-AI-Systems/github-mcp`, next card A-2) |
| 6 | Messaging MCP (`messaging-mcp`) | `resend` (52), `twilio` (115) | Email and SMS for any app; one server, two areas, strict "messages to people" guard; build-time: test-mode sends to Chris only, inbound simulation, domain/number setup checks | Not started |
| 7 | Sentry MCP (`sentry-mcp`) | `sentry` (104) | Errors, performance, releases; build-time: "what broke in this preview", issue triage | Not started |
| 8 | Cloudflare MCP (`cloudflare-mcp`) | `cloudflare` (187) | DNS, CDN, Workers, R2, Zero Trust; when a project uses Cloudflare | Not started |
| 9 | Clerk MCP (`clerk-mcp`) | `clerk` (102) | Users, organizations, sessions for apps that use Clerk; build-time: test users and orgs, cleanup | Not started |
| 10 | Supabase MCP (`supabase-mcp`) | `supabase` (127) | Database, auth, storage for apps on Supabase | Not started |
| 11 | AI providers MCP (`ai-providers-mcp`) | `openai` (133), `anthropic` (64), `gemini` (31), `moonshot` (17), `voyage` (11) | Usage, keys, models, batch jobs across AI vendors; admin keys separate from app keys | Not started |
| 12 | Data stores MCP (`data-mcp`) | `upstash` (197), `qdrant` (71), `postgres` (111) | Redis, vectors, any Postgres by connection string (production guard on SQL writes) | Not started |
| 13 | Work tools MCP (`work-mcp`) | `linear` (64), `slack` (69), `n8n` (79) | Issues, chat, automations | Not started |
| 14 | Mapbox MCP (`mapbox-mcp`) | `mapbox` (51) | Maps, routing, geocoding for any app | Not started |
| 15 | Research MCP (`research-mcp`) | `search` (30), `context7` (45), `sam` (21) | Web search, current library docs, SAM.gov federal contracts — research while building | Not started |
| 16 | Fly MCP (`fly-mcp`) | `fly` (116) | Only if a project runs on Fly.io | Not started |

Every server covers all three audiences (contract §11, playbook §2): builders, account owners/administrators and day-to-day
operators — e.g. Vercel's team members, billing and usage, domains and security as well as deployments; Neon's
organization, members, plan, usage and project settings as well as branches; GitHub's organization, members, teams,
security settings, billing and apps as well as repositories.

Grouping rule: one server per large service; small services that share a purpose and a risk type share a server (each
keeps its own credentials and area). Any group can be split later without changing tool names (they are prefixed by area).

## Hub-native (this repo)

| Old namespace (old tools) | New home |
|---|---|
| `compound` (46) | Hub cross-server workflows (Batch C), ported only when their servers exist and Chris wants them |
| `local` (87) | `rtool mcp` local tools (Batch L-1) |
| `ollama` (16) | `rtool mcp` local tools (L-2) |
| `playwright` (47) | `rtool mcp` local browser (L-3) |

## The old toolkits

Reference only: the "covers old namespaces" column says which old tool lists each server's gap check must cover. No
compatibility, bridge or migration (Chris, 2026-10-10).
