# Owner guide — what you can ask for

| Say something like… | What happens | Batch |
|---|---|---|
| "Set up Codex to use my Stripe server." | A pass is made on the Stripe server (shown once), and Codex gets the one-paragraph setup to install `rtool` | D |
| "Use my Workspace and Stripe tools from this cloud workspace." | `rtool` reaches them directly, or through the GitHub relay if the workspace only allows GitHub | D |
| "Start a server for Vercel." | A full plan for a new Vercel server, in its own repo, ready for Sol to build | S |
| "Search all my tools for 'refund'." | One search across every server (hub) | H |
| "Review my Vercel (or Stripe, or GitHub) account setup." | Everything owner-side in one view: business details, team and roles, security, plan and bill, settings — ok or needs attention | O (each server) |
| "Add Sam to the team as a developer." / "Turn on two-step login." | Done by the server where the service allows it; otherwise a guided walk-through in a browser you watch, then checked | O, L-4 |
| "Spin up a dev environment for this feature." | One preview: a branch, a database branch, a preview deploy with its settings wired, Stripe test data and event forwarding; one confirmation; one command tears it all down | C |
| "Provision a new tenant." | One preview across the servers involved; one confirmation; a record you can undo where possible | C |

## Coding-agent development access (2026-10-13)

The implementing agent uses a renewable native OAuth connection, not a new copied RTC
pass for every retest. `rtool developer-connect ALIAS --profile full` prepares one mobile
link using the custom service. Choose the intended account/resources and authorize once;
return to chat without copying secrets. The agent reruns the command to finish privately,
then uses developer-check, developer-tools and developer-call. Existing original service
write previews, owner approvals and resource guards still apply. This developer workflow
does not reduce the finished product's tool capabilities.

On a managed POSIX cloud runner, configure RTOOL_DEVELOPER_VAULT_DIR to an absolute private
folder outside every Git checkout. The CLI creates a separate 0600 encryption key and
AES-GCM encrypted connection files in a 0700 folder; keep that private runner state for
resumes. OS credential managers remain the desktop default. Neither option places secrets
in chats, prompts, Git or shared artifacts. Initial provider consent or an expired/revoked
underlying authorization can still require a new owner sign-in. Source/tests are not
proof that the new deployed workflow has been exercised against the real provider.
