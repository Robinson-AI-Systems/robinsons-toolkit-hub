# Owner guide — what you can ask for

| Say something like… | What happens | Batch |
|---|---|---|
| "Set up Codex to use my Stripe server." | A pass is made on the Stripe server (shown once), and Codex gets the one-paragraph setup to install `rtool` | D |
| "Use my Workspace and Stripe tools from this cloud workspace." | `rtool` reaches them directly, or through the GitHub relay if the workspace only allows GitHub | D |
| "Start a server for Vercel." | A full plan for a new Vercel server, in its own repo, ready for Sol to build | S |
| "Which of my old toolkit tools still work?" | The smoke-test report, namespace by namespace | M |
| "Search all my tools for 'refund'." | One search across every server (hub) | H |
| "Provision a new tenant." | One preview across Stripe, database, login and email; one confirmation; a record you can undo where possible | C |
