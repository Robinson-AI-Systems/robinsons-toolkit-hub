# D-4 — verified actual Sandbox and same-pass revocation (2026-10-16)

Owner explicitly authorized one metered, temporary Vercel Sandbox; no
extra spending or feature phase approved. Evidence below is from the
original reviewed Hub CLI modules, not mocks, and remains separate from
the already working Hub Cloud connection.

## Reconciled real service, issuer and runner

- Original Hub source: `f6f916b8f2f6a596583328540593f3098dc2ff27`.
  The latest Hub `main` has docs-only PR #225 after this released source;
  Hub `live` and Vercel production remained on this source during
  acceptance. No deployment was needed.
- Original independent Workspace server, RTC 1, exact identity
  `google-workspace-mcp`, original Vercel production READY revision
  `42afbaaf138d293d6042acd874c0fd3c32f7ce0e`;
  `GET /api/contract` previously returned HTTP 200.
- Disposable provider credential: TEST/read_only/no writes,
  exact `areas=['workspace']`, for_hub=false, issuer-created 4-hour
  lifespan. Verified by provider's own pass store and matched
  cryptographically to the pass available inside the isolated runner,
  without writing the pass or hash into git, logs or chat.
- Vercel Sandbox:
  `d4-workspace-read-20261016`, original
  `scripts/agent-check.mjs` and transitive original Hub/relay-source
  modules staged from reviewed immutable Hub SHA, no source modification.
  1 vCPU/2 GiB, nonpersistent, outbound policy restricted to the exact
  independent Workspace RTC HTTPS domain; temporary pass only in the
  VM environment, never the published Hub grant.
- `2026-10-17T00:19:42.802Z` UTC, exact original CLI invocation:
  `node scripts/agent-check.mjs --server workspace --read-tool
  workspace_whoami --pass-env RTOOL_D4_TEST_PASS --expect-route direct
  --authorized-real-run`
  → exit **0**, result
  `ok=true,route=direct,code=verified`; checks
  `rtc_1_manifest,read_only_pass,test_mode,read_only_metadata,guarded_read`.
- Credential removal: Owner-authorized original independent Workspace
  issuer `workspace_revoke_connection` dry-run selected exactly the
  disposable pass, confirmed revocation at 2026-10-17T00:22:45.787Z.
  `2026-10-17T00:23:11.546Z` UTC, actual
  `node scripts/rtc-revocation-probe.mjs --server workspace
  --pass-env RTOOL_D4_TEST_PASS --authorized-revoked-test`
  → exit **0**, `ok=true,revocationVerified=true`,
  `reason=explicit_pass_revoked`, **HTTP 401**, `route=direct`,
  `fullAcceptance=false`. This is the *same* pass that had
  succeeded through the real Sandbox direct route.
- Independently revoked the earlier unused duplicate temporary D-4
  pass with exact issuer-dry-run and one-pass confirmation. The existing
  independent `for_hub=true` read_only TEST service pass was left
  unrevoked and one active, verified Hub service grant persisted.
  Sandbox stopped (no running compute), the Development-only
  `RTOOL_D4_ACCEPTANCE_RUNNER_PASS` Vercel encrypted entry overwritten
  with an inert marker and verified not to hold a bearer. No Production
  or Preview test-pass environment entries remain.
- All tools ran under existing TEST/read_only and no owner-controlled
  Workspace provider data, pass values or pass hashes were printed
  or persisted in project documentation.

## Acceptance verdicts

| Test | Result | Verified outcome |
| --- | --- | --- |
| Native Hub → Workspace RTC | **PASS (reused)** | PR #224 hosted genuine read, reconfirmed after encrypted-only cutover. |
| Sandbox direct `agent-check` | **PASS (new)** | Real RTC manifest/identity/metadata/read, direct route, exit 0, pinned original source. |
| Same-disposable-pass issuer revocation | **PASS (new)** | Original `rtc-revocation-probe`, service-native HTTP 401 `pass_revoked`, exit 0. |
| TEST read-only boundary | **PASS (reused)** | Hub did not dispatch known Workspace write tool; attempt count remained 8 before and after. |
| Independent original local direct runner | **NOT RUN** | No authorized separate local/agent runner with the dedicated credential; the Sandbox direct proof cannot be relabeled. |
| GitHub-only X25519 encrypted relay | **NOT RUN / blocked prerequisites** | Binding/webhook/least-privilege/actual GitHub-only runner absent; real encrypted ciphertext transit unproved. |
| Disposable-test cleanup | **PASS (new)** | Both D-4 temporary issuer passes revoked; Sandbox stopped; secret entry made inert; useful original Hub grant preserved. |

## Unfinished exact D-4 prerequisites

Only these distinct eligible acceptance gates remain open. The private
GitHub transport issue #1 is explicitly inactive and no configured
`RELAY_SERVERS` or `RELAY_BINDINGS` exist. A GET to the relay
ingress produced HTTP 405 `method_not_allowed`, which is not a signed
POST proof. GitHub webhook state and hosted relay token's exact Issues-
only permissions cannot be inspected through the available GitHub
connector, which is scoped to a separate scratch account. Do not
invent webhook status, claim a real `expect-route relay` result or
copy raw repo/app credentials.

Before reopening D-4: independently verify the relay's one-repo
Issues-only token, sign and validate the `issue_comment` webhook
under the existing deployment protection, establish only owner-scoped
temporary numeric actor/issue/server bindings and fixed RTC origin,
then use a separately issued disposable Workspace TEST/read_only
pass in the *actual GitHub-only* runner. Run the original
`agent-check` with `--expect-route relay`, capture safe route/exit,
independently revoke that exact pass at the original issuer and
verify its same-pass `401 pass_revoked`, and clean up only temporary
resources. Run the separate original direct local agent proof if
a genuinely separate protected local runner is available. Never
reuse the standing Hub pass, bypass CI, widen permissions, or
introduce reverse Workspace → Hub discovery.

PR #224 hosted receipt:
https://github.com/Robinson-AI-Systems/robinsons-toolkit-hub/pull/224#issuecomment-6216311463

