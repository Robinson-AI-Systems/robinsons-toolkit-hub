# Robinson's Toolkit

A general, powerful development tool: the long-term front door to all of Chris Robinson's tool servers, usable by any
AI agent on any project. Each service (Google Workspace, Stripe, and later
Vercel, Neon, GitHub and more) is its own solid, standalone server following the **Robinson Tool Contract**
([`docs/CONTRACT.md`](docs/CONTRACT.md)). This repo holds the contract and its conformance test, the `rtool`
command-line tool and GitHub relay that let any AI agent use any server from anywhere, the shared `robinson-mcp-core`
package, the hub server that combines them, and the playbook for building each new server.

**Status:** plan only; no code yet. Start at [`docs/START-HERE.md`](docs/START-HERE.md). AI agents: read
[`AGENTS.md`](AGENTS.md) first. The previous, local toolkit lives on (frozen) in `Robinson-AI-Systems/robinsons-toolkit-mcp`.
