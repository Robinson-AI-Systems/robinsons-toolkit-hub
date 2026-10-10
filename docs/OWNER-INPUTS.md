# Owner inputs and decisions

| ID | Status | Question | Blocks | Recommended / safe default |
|---|---|---|---|---|
| IN-00 | **Answered 2026-10-10: approved** | This architecture: one standalone server per toolset, combined later by Robinson's Toolkit; build servers as needed; own servers for Vercel, Neon and others | Nothing | — |
| IN-01 | **Answered 2026-10-10:** Chris created `Robinson-AI-Systems/robinsons-toolkit-hub` | Repository and names | Nothing | Product "Robinson's Toolkit" (the hub); CLI `rtool`; shared package `robinson-mcp-core`; contract "Robinson Tool Contract (RTC)" |
| IN-02 | Awaiting Chris (before D-3 deploys) | Create a Vercel project and Neon database for the relay (and later the hub), free tiers | D-3 real deployment | Free tiers; Claude can create them with the connectors once you say go |
| IN-03 | Awaiting Chris (before D-3) | Create a **private** repository `Robinson-AI-Systems/robinsons-toolkit-relay`; later give each agent's GitHub account access to that one repository only | D-3, D-4 | Private; one-repo access |
| IN-04 | Awaiting Chris (with IN-02) | Set the relay's private key and webhook secret in Vercel yourself (DEPLOY steps written in D-3) | D-3 | — |
| IN-05 | **Answered 2026-10-10 — not needed** | Old toolkit freeze and smoke test: dropped with Batch M (no compatibility with the old toolkits; Chris). | Nothing | — |
