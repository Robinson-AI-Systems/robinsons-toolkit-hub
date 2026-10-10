# Robinson's Toolkit

A general, powerful tool for developers and account owners alike: the long-term front door to all of Chris Robinson's
tool servers, usable by any AI agent on any project — building with a service, or setting up and running the account. Each service (Google Workspace, Stripe, and later
Vercel, Neon, GitHub and more) is its own solid, standalone server following the **Robinson Tool Contract**
([`docs/CONTRACT.md`](docs/CONTRACT.md)). This repo holds the contract and its conformance test, the `rtool`
command-line tool and GitHub relay that let any AI agent use any server from anywhere, the shared `robinson-mcp-core`
package, the hub server that combines them, and the playbook for building each new server.

**Status:** plan plus the repository foundation (checks, test harnesses, CI); no product code yet. Start at [`docs/START-HERE.md`](docs/START-HERE.md). AI agents: read
[`AGENTS.md`](AGENTS.md) first. The previous toolkits are reference material only; nothing keeps compatibility with them.
