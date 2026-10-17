# Robinson's Toolkit

A general, powerful tool for developers and account owners alike: the long-term front door to all of Chris Robinson's
tool servers, usable by any AI agent on any project — building with a service, or setting up and running the account. Each service (Google Workspace, Stripe, and later
Vercel, Neon, GitHub and more) is its own solid, standalone server following the **Robinson Tool Contract**
([`docs/CONTRACT.md`](docs/CONTRACT.md)). This repo holds the contract and its conformance test, the `rtool`
command-line tool and GitHub relay that let any AI agent use any server from anywhere, the shared `robinson-mcp-core`
package, the hub server that combines them, and the playbook for building each new server.

**Status:** implemented contract/conformance, CLI/SDK/local MCP, encrypted relay and hosted Hub foundations. Actual Workspace D-4 integration and cleanup are accepted in [PR227](https://github.com/Robinson-AI-Systems/robinsons-toolkit-hub/pull/227). Other Hub roadmap and fleet acceptance remain open in [STATUS](docs/STATUS.md); this is not a whole-Hub completion claim. Start at [`docs/START-HERE.md`](docs/START-HERE.md). AI agents: read
[`AGENTS.md`](AGENTS.md) first. The previous toolkits are reference material only; nothing keeps compatibility with them.
