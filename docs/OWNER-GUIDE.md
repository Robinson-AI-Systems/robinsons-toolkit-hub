## Direct native MCP gateway versus ChatGPT Cloud adapter (owner directive, 2026-10-19)

The Hub is **one connection for your coding agent**, not a planning agent and not a copy of any particular standalone provider. Its independent hosted native remote MCP endpoint is `https://robinsons-toolkit-relay.vercel.app/api/mcp`. The separate original Hub OAuth issuer is `https://robinsons-toolkit-relay.vercel.app`, with standard public protected-resource metadata at `/.well-known/oauth-protected-resource`. The private attributed connection name is **Robinson's Toolkit Hub by Robinson AI Systems**; its machine name and `hub_*` tools stay unchanged. It is an independent unofficial product and does not imply endorsement by a provider.

On a compatible desktop or mobile coding-agent client that supports adding an arbitrary HTTPS Streamable HTTP MCP endpoint and OAuth PKCE, register the exact `/api/mcp` URL. Follow **that client's** built-in account authorization flow; select your genuine Hub owner-approved LIVE or TEST mode, profile, gateway area, and eligible service scope. Refresh/reconnect through the original issuer and client UI. A working setup must show `hub_whoami`, `hub_search_tools`, `hub_describe_tool` and `hub_call` as part of the *fixed* menu, followed by a real authenticated tool call; an MCP initialize handshake or OAuth login page is insufficient. Supported source protocol versions currently tested are 2025-03-26, 2025-06-18 and 2025-11-25; newer 2026 protocol compatibility and exact third-party client desktop/mobile availability are not yet independently verified. Clients that do not permit adding a remote custom MCP in their current mobile UI must not be described as supported; use a supported client, not a forced local IDE.

To add Workspace *through Hub*, open the private Hub owner page `https://robinsons-toolkit-relay.vercel.app/api/owner/connect-mcp` in a browser on your own device, authenticate there and use the genuine Workspace public HTTPS origin. Hub discovers the RTC1 server and its issuer; after the agent has a valid independently authorized **LIVE** Hub family, select it and a read-only Workspace profile and complete the *Workspace-issued* OAuth sign-in in that browser. Never paste the owner passphrase, service pass, Google refresh token, or connected account details into a chat message. Public discovery is not provider consent; a successful login is not proof of tool access. The first live acceptance is `workspace_whoami`, one harmless tool read, scope denial, refresh/revocation and preservation of standalone Workspace access; record exact serving SHAs and client/device. The earlier TEST connection cannot be upgraded or reused as LIVE. At the time of this plan, no LIVE family exists; owner sign-in/client setup remains required.

The current Robinson Hub Cloud adapter may return only Hub-owned metadata and report `upstreamEnabled:false`; it is **not** evidence that the direct hosted MCP gateway has failed, nor evidence that its upstream routes work. It is optional and needs separate client acceptance. Private app listing/rebranding is distinct from source UI and must not be made publicly discoverable without separate owner publication approval.

## Early Workspace discovery after checked Hub release

On the deployed Hub owner control center, use `/api/owner/connect-mcp` → **Discover service and OAuth support**. Enter the existing Workspace MCP public origin `https://google-workspace-mcp-chris-projects-de6cd1bf.vercel.app` and the Hub owner passphrase. The Hub itself fetches RTC1 manifest and standard issuer metadata. That public inspection **does not** register a remote OAuth client, contact Google, or authorize tools.

When a current Hub OAuth agent session is eligible, the page selects it automatically if unique, or displays an explicit selector if several. Choose the correct existing Hub agent, LIVE mode, `read_only` profile and genuinely needed area(s), then follow the original Workspace issuer sign-in/consent; keep the old owner and pilot identities intact. If no Hub session is eligible, the form stops with a truthful prerequisite instead of quietly using a historic TEST grant. This UI is source-only until the Hub's checked production release and additive OAuth SQL migrations are installed.

First hosted acceptance: capture exact Hub+Workspace serving SHAs, normal Hub→Workspace discovery, consented account whoami, one harmless authorized Google READ through fixed Hub tools, denied out-of-scope request, original issuer refresh/revocation and standalone Workspace read. Never treat public discovery success alone as completed federation; do not authorize a billable or modifying operation.

## Large OAuth MCP read results and connection readiness — source gated

The agent still sees the same small fixed Hub menu. Authorized remote MCP reads that exceed the safe inline response size (8 KiB) are stored encrypted (up to 64 KiB) under the exact owning Hub connection and service. Follow the returned `hub_result_read` handle and its zero-based `page` counter; no original provider request is repeated just to fetch a page. Each page requires the same active original caller, service, environment/profile/areas and unexpired provider connection. Switching accounts, narrowing permissions, expiry or revocation makes the old pages unavailable. Original RTC1 HTTPS pass-backed results remain supported.

Owner-only `/api/owner/readiness` and its dashboard readiness tab show optional OAuth connection metadata such as TEST vs LIVE counts, issuer-refresh availability, imminent expiration and required reconnection, without decrypting provider tokens. The `/api/owner/connect-mcp` page lets the owner inspect or reauthorize a provider through the provider's own sign-in. The readiness page **cannot** prove that Workspace is actually authenticated or that its deployed OAuth issuer is current; perform real harmless Workspace end-to-end acceptance after authorized release.

## Hub-initiated OAuth service connections — source implementation, deployment gated

The Hub is **one compact MCP connection for the coding agent**. The owner and agent plan the work; the Hub does not replace planning. It discovers RTC-compliant servers, selects an authorized provider and tool, fetches only needed metadata and routes calls through the provider's own guards.

After a separately checked release of PR #237 and its additive OAuth migrations, the owner can visit `/api/owner/connect-mcp` in the Hub control center, provide the selected server's exact public HTTPS origin, inspect the discovered RTC and OAuth identity, select their own existing Hub connection/areas/profile, and approve the provider's original OAuth consent page. The Hub never asks the owner to post a provider token in chat. The resulting bearer and refresh tokens are encrypted for the selected caller family. `hub_search_tools`, `hub_describe_tool` and `hub_call` use the same bounded gateway whether a selected service uses an original RTC HTTPS pass or this newer MCP OAuth transport. Direct provider use and existing RTC setup remain supported.

**Do not interpret a green source test, saved token or local dashboard label as real connection acceptance.** Prove the original provider is currently serving the expected revision and consented mode/profile/areas, perform a real harmless `whoami` read through Hub, verify scoped denies, audit attempt/outcome and issuer refresh, and keep the original direct connection working. A provider without registered OAuth discovery can still use the existing RTC setup; it does not need Hub-specific code. Provider writes require their own current authorization and workflow execution/confirmation validation, not merely an OAuth profile labeled `full`. No producer account, grant or production data has been touched by this source PR.

## Retrieve large RTC read results

When an authorized RTC read returns a stored handle, `GET /api/results/{handle}?page=0` uses the same Hub pass. Follow the returned `next` page number and decode/reassemble the base64url byte pages. RTC handles work with the caller's existing TEST or LIVE scope; every page rechecks the original provider grant. A revoked caller is denied and a revoked/replaced grant, expired handle or removed service is unavailable. Retrieval never repeats the provider call. Legacy Hub-only handles retain their original TEST/read-only policy. Hosted normal-flow proof for the repaired HTTP route remains pending until its checked source is released.

## Connection readiness before a release

Open the private control-center readiness tab or `/api/owner/readiness` and authenticate with the existing owner passphrase. TEST and LIVE configuration counts are separate. Review missing schema through the existing checked deployment/migration procedure; this view never installs migrations or changes a connection. OAuth write delegation is optional for read-only use. A ready configuration still needs the actual normal Connect a service flow, the selected caller's authorization, harmless routed read, denied boundaries and exact revocation before it counts as a working connection. Expired callers may leave unexpired stored grants, so counts alone never authorize routing.

Service manifests may call their environments test/live or preview/production. The connection view shows the original labels and the equivalent Hub choices. A production credential is always a LIVE credential. A full/everyday Hub profile without explicit write delegation cannot enroll a writable service credential; no provider credential is forwarded for that refusal.

## Normal service discovery and connection (source repair; not released)

Use **Connect a service** in the protected Hub control center. Enter the independent service's canonical HTTPS origin and authenticate with the Hub owner passphrase. The Hub reads that service's RTC manifest, prepares a pending public registry entry and displays the discovered identity and advertised choices. This does not grant access or prove the service's deployed source revision.

Choose one current Hub agent connection, matching TEST or LIVE mode, service-issued profile and allowed areas. Obtain a separate scoped RTC pass directly from that service and enter it only in the protected connection form, never chat. Approve again with the Hub owner passphrase. The Hub verifies the provider's exact identity/policy and encrypts its credential for that selected caller; it cannot issue or broaden provider authority. Non-read-only selection requires explicit write acknowledgment plus independently entitled original credentials; provider safeguards still apply. If no current connection is listed, first connect an agent to the Hub selecting the newly registered service and mode, then repeat discovery. Expired OAuth sessions must refresh through their original agent, not by copying a rotating checkpoint.

Existing active/staged grants are preserved. Use the existing grant renewal or staged-grant recovery screen for a replacement. A failed activation may leave one noncallable staged grant; inspect it before retrying. The older Workspace-only TEST shortcut remains compatibility-only. This source repair needs checked release and genuine normal-flow acceptance; a forced TEST route or synthetic provider cannot prove it works in production.

# Owner guide — what you can ask for

## Workflow plan, confirmation, status and undo — C-1 reviewed source only

After a checked release and independent provider credential setup, an
authenticated Hub agent can call these own-tool names:

- `hub_workflow_plan({spec:{workflow,steps:[{server,tool,args}]}})`: previews
  every server's own real dryRun. No side effects. Record the returned `runId`.
- `hub_workflow_execute({runId,spec,confirm:true})`: explicitly confirms the
  *unchanged* original plan; requires current independently verified provider
  write permissions and follows provider-owned guards.
- `hub_workflow_status({runId})`: inspect the run's safe per-service receipts,
  unknown effect/undo status, provider change-log references and untouched steps;
  never re-submit an unknown write.
- `hub_undo_run({runId,confirm:true})`: a *separate* confirmed reverse-order
  operation, only where a provider returned an actual valid non-money inverse.
  Money-moving, irreversible and uncertain steps are **not** undone.

To enable this **in a future approved release**: install additive migrations
022 and 024 after their existing prerequisites (including already reviewed
023); provision a fresh 32-byte base64url secret as protected
`HUB_WORKFLOW_KEY` via the host secret manager, not in chat or a PR; create a
**new**, owner-authorized everyday/full Hub pass or OAuth consent with exact
selected TEST services and explicit write acknowledgment; then separately
issue and verify exact TEST service passes on each original standalone
provider and verify their service-specific guards. Old read-only credentials
do not gain write rights. Neither source CI nor an old READY deployment
demonstrates real provider acceptance. Do not use paid/LIVE actions for
developer acceptance without a separately approved authorization.

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
