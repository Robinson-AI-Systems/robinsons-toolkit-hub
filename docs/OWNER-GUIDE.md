# Owner guide — what you can ask for

| Say something like… | What happens | Batch |
|---|---|---|
| "Set up Codex to use my Stripe server." | A pass is made on the Stripe server (shown once), and Codex gets the one-paragraph setup to install `rtool` | D |
| "Use my Workspace and Stripe tools from this cloud workspace." | `rtool` reaches them directly, or through the GitHub relay if the workspace only allows GitHub | D |
| "Start a server for Vercel." | A full plan for a new Vercel server, in its own repo, ready for Sol to build | S |
| "Which of my old toolkit tools still work?" | The smoke-test report, namespace by namespace | M |
| "Search all my tools for 'refund'." | One search across every server (hub) | H |
| "Spin up a dev environment for this feature." | One preview: a branch, a database branch, a preview deploy with its settings wired, Stripe test data and event forwarding; one confirmation; one command tears it all down | C |
| "Provision a new tenant." | One preview across the servers involved; one confirmation; a record you can undo where possible | C |
