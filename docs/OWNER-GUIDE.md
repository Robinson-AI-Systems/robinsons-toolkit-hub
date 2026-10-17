# Owner guide — what you can ask for

## Hosted Hub routed history — current owner experience

The Hub's protected owner control center links to `/api/owner/changes`. It provides **audit receipts for Hub-mediated RTC reads**, not a provider's full account history. Each private history page requires entering the **Hub owner passphrase** independently; there is no persistent logged-in owner session. The source-level next-release update supports an optional registered service, exact RTC tool name, and UTC inclusive from/through dates, retaining that selection on older-page continuations. Invalid inputs are refused. The same optional `server`, `tool`, `since` and `until` filters can be supplied to `hub_recent_changes` through the authenticated native Hub MCP or RTC HTTPS door. No provider pass, result content, request arguments, or private credential is shown.

**Release boundary:** As of 2026-10-17, hosted Vercel READY still serves `f6f916b8`. The owner-approved migration 019 restored basic Hub history reads on that revision. New exact-grant isolation, tool/date filtering, and owner UI are source work awaiting checked merge/release and genuinely authenticated follow-up. They are not currently live. A revoked or expired caller grant is never a substitute for provider-origin logs; real two-provider H-3/H-4/H-5 acceptance is still open. A second independent TEST service grant must be issued by that service, never inferred from the existing Workspace standing grant.

## Current Workspace integration acceptance — October 17, 2026 UTC

D-4 is complete for the independent Workspace RTC service: original separate local direct, GitHub-only encrypted relay and Vercel Sandbox direct runners passed; native audited Hub read, TEST/read-only refusal, same-pass issuer revocation and all temporary cleanup are verified. See [D-4](pr-cards/D-4.md) and [the exact sanitized receipt](audits/2026-10-17-d4-final-route-acceptance.json). Other Hub fleet/service, optional core publication and remaining roadmap obligations stay separately open in STATUS; this does not declare the whole Hub project complete.

The temporary relay is now disabled: webhook inactive, routing maps empty, issue closed/zero comments, disposable passes/token and ingress bypass revoked, Sandbox stopped. Existing hosted credentials and useful standing Hub grant are preserved. Activation for a new agent/service needs its own approved binding and scoped credentials; never reuse revoked test material. Workspace remains fully standalone and does not discover Hub.


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

## Local guided settings (L-4 — source under review)

On a desktop with Node 24 and locally installed Playwright Chromium, `rtool guide <server> "<setting>"` asks the configured standalone RTC1 service for its structured owner instructions. It opens a new **visible** browser (not the background automation browser). The owner logs in personally and acknowledges each step in the terminal; the tool never fills password, 2FA or other form fields. It verifies only an advertised, authorized **read-only** `verifyWith` and clearly reports `unverified` when no safe readback is available or it disagrees. A missing owner confirmation cancels remaining steps. Nothing in this path grants provider mutations or changes the server's original permissions.

While PR #230 remains under review, this is source behavior only, not proof of actual owner-browser or provider acceptance. The feature needs a local desktop and browser; a phone-only ChatGPT connection cannot run this local UI for you.

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

Protected Vercel endpoints additionally require an already authorized hosting identity.
Run the developer CLI in a Vercel-authenticated environment that supplies VERCEL_OIDC_TOKEN,
and pin exact target Vercel origins in RTOOL_PROTECTED_ORIGINS. The client forwards that
short-lived identity only to those origins and still separately sends native service OAuth.
A target Trusted Sources rule must allow the caller's development environment to reach the
protected production-hosted MCP; app TEST/preview remains a separate service grant. Never
disable protection or copy a static bypass secret as a workaround. A missing hosting grant
is a concrete infrastructure prerequisite, not evidence the custom service is broken.
