# D-4 — actual Workspace route checkpoint (2026-10-16)

Owner request: close existing acceptance, no implementation/new features.
Hub must discover Workspace; Workspace is a standalone RTC service and does
not discover the Hub. The useful owner-authorized Hub grant must survive.

## Reconciled host and source

- Hub GitHub main/live `f6f916b8f2f6a596583328540593f3098dc2ff27`,
  production Vercel READY same revision.
- Workspace RTC 1 manifest HTTP 200, exact service
  `google-workspace-mcp`, prefix `workspace`; Vercel READY source
  `42afbaaf138d293d6042acd874c0fd3c32f7ce0e`.
- Reused immutable PR #224 hosted acceptance:
  https://github.com/Robinson-AI-Systems/robinsons-toolkit-hub/pull/224#issuecomment-6216311463
  (real audited ChatGPT → Hub → Workspace read and durable receipts).
- Independently repeated the read after the owner's stated Workspace
  encrypted-only cutover: `hub_provider_read` of
  `workspace_whoami` returned `matches=true` and TEST read-only
  authorization. No owner/account secrets reproduced here.
- A separate read-only Hub call targeting actual Workspace write tool
  `workspace_gmail_create_label` failed before provider POST with
  `RTC read metadata unavailable`. Hosted audit attempts were 8
  before and after, with no new attempt. This checks pre-dispatch
  read-only filtering, NOT revocation.

## Required distinct D-4 gates

| Gate | Status | Reason |
| --- | --- | --- |
| Native Hub authenticated RTC discovery/read | PASS (reused + reconfirmed) | PR #224 and fresh live TEST read. |
| Original direct protected CLI agent-check | NOT RUN | No new disposable service-issued pass in a protected original agent runner. Native Hub read is a different door. |
| Private GitHub encrypted relay actual agent-check | NOT RUN | Private transport issue #1 inactive, production RELAY_SERVERS and RELAY_BINDINGS absent; actual webhook signature/permissions unproven; no dedicated pass. |
| Vercel Sandbox direct allow-listed agent-check | NOT RUN | Zero named sandboxes, no protected test credential, no independent Sandbox runner exit or allowed egress observation. Do not autonomously incur Sandbox usage cost. |
| Same-pass owner revocation and 401 pass_revoked | NOT RUN | No newly issued disposable pass safely available to read and then revoke. Existing Hub grant explicitly preserved. |
| Temporary test resource cleanup | NOT APPLICABLE YET | No disposable pass, issue binding, Sandbox, webhook, or server env changes created in this checkpoint. |

Other observations: private transport repository exists, issue #1 open
but inactive, installed relay ingress GET returned HTTP 405
`method_not_allowed`, which is NOT a signed webhook proof.
The Vercel production environment has relay secrets/key configuration
but no live server mapping or issue binding. The available GitHub custom
connector is enrolled only for an unrelated scratch account, and the
standard GitHub read connector does not expose repo webhook listing;
therefore webhook state is UNKNOWN, not asserted absent.

## Safe required continuation

1. Owner independently issues *disposable* Workspace TEST read_only,
   nonwriting pass(es), distinct from the useful Hub connection,
   through the provider's protected RTC passes form. The pass must be
   deposited only into the approved temporary test runner/vault.
2. Verify one-repo Issues-only relay token, exact owner-approved
   numeric GitHub actor, signed issue_comment webhook and narrowly
   bound new test issue, without exposing signing or provider secrets
   or disabling global Vercel Deployment Protection.
3. Run original `agent-check` in the **three actual runner contexts**
   with exact deployment pins and log neutral route/exit observations.
   The Sandbox is only created under applicable spending approval.
4. Revoke only disposable pass(es) with the original issuer, rerun
   `rtc-revocation-probe` to prove exact same credential HTTP 401
   JSON `pass_revoked`, and remove only temporary resources.
5. Close D-4 only after real route/revocation and cleanup evidence.
   Do not rerun onboarding, reverse discovery direction, or weaken
   provider-owned authorization to manufacture a PASS.

No new feature code, provider write, credential mutation, production
promotion, extra spend, or destructive cleanup was performed.
