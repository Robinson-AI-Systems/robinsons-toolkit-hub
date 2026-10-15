# SESSION-START — reconcile, accept released work, implement, close out

## Autonomous execution contract

“Do N bundles” authorizes continuing the full documented process without routine
permission stops: reconcile → perform eligible acceptance → implement → verify →
review/merge → cleanup/handoff → next outcome until N and eligible obligations are
satisfied. Checkpoints preserve progress; they do not end otherwise feasible work.

On a terminal failure, diagnose and repair; on green CI, handle reviews and merge
when authorized. During pending CI, do useful independent scoped work, then recheck
at a meaningful transition. Repeated unchanged results require a different action,
not a busy loop. Never silently stop or imply background execution after a turn ends.

Before a blocker can justify stopping, identify its exact error/evidence, investigate
its cause, check already-recorded decisions and attempt authorized remedies. Isolate
one blocked operation and continue independently eligible work. If nothing authorized
can proceed, explain to the owner: what is blocked, why, what was tried, what specific
input/permission/resource or fix you believe would unblock it, and your recommended
next action. Ask genuinely missing owner input promptly while independent work proceeds.
An actual execution limit gets an explicit incomplete recoverable checkpoint, never
a completion claim. Preserve every real safety, spending, release and approval gate.


## Bundle target and delivery boundaries — owner correction 2026-10-15

The current owner's N counts substantial NEW engineering outcomes, not PRs or
small card remainders. Normal guides remain 2–5 completed existing subsections
and about 400–800 meaningful production lines; neither is a padding requirement,
ceiling or automatic certificate. Previously implemented behavior, reconciliation,
test volume, CI waiting and closeout do not make a small remainder substantial.

**Plan before code.** In the existing selected execution card, preserve one
`bundle-plan` JSON block (schema below). Inspect actual main and record the NEW
remaining engineering, original full acceptance for each existing approved ID,
integration boundary, honest new-work estimate and why related adjacent approved
work is included or excluded. Prefer a coherent group of whole related subsections.
Run `npm run session:bundle -- --card docs/EXISTING-CARD.md`, then commit that
card before implementation; retain the exact planning SHA. That local docs commit
is a checkpoint in the implementation PR, never a separate plan-only PR or an
owner approval stop. Do not copy the whole roadmap or plan distant bundles.

The block is bounded by `<!-- bundle-plan:start -->` and
`<!-- bundle-plan:end -->`, containing one fenced `json` object:

```json
{
  "baseRevision": "EXACT_FULL_HEAD_BEFORE_PLANNING_COMMIT",
  "outcome": "Observable coherent outcome from approved scope",
  "integrationBoundary": "Domain, persistence, callers and failure/recovery paths",
  "newEngineering": "Missing NEW behavior; distinguish already implemented code",
  "estimatedProductionLines": 650,
  "relatedWorkDecision": "Related approved work selected or concrete reason to exclude",
  "subsections": [{
    "id": "EXISTING-APPROVED-ID",
    "acceptance": ["Full original criterion, repeat for every criterion"],
    "remainingEngineering": ["Actual missing engineering at inspected baseline"]
  }]
}
```

**Compare before publication and completion.** Preserve the original block; record
deviations beside it rather than rewriting it to match a small delivery. A temporary
sanitized delivery JSON has `subsections` rows with the same `id`, `criteria`
(each with exact `criterion` and concrete `evidence`) and `remainingEngineering`
(empty only when complete); plus actual `productionAdded`, `productionRemoved`,
`newEngineering`, `planComparison`, `relatedWorkDecision` and `decision`.
Run `npm run session:bundle -- --card docs/EXISTING-CARD.md --planned-at FULL_SHA
--report /tmp/bundle-delivery.json`. Retain the comparison in the existing PR/card
handoff; the temporary JSON is accounting, not another roadmap or private evidence.

Use `decision: "CONTINUE"` when only a small remainder is done or planned engineering
remains. Keep it as contribution toward this same bundle and continue related
approved work; a merged small PR is not a successful session finish. Do not recount
old work. For a complete substantial delivery use `SUBSTANTIAL`. A delivery with
fewer than two subsections or below 400 changed production lines instead requires
`SUBSTANTIAL_EXCEPTION` and `exceptionEvidence`: concrete NEW workload/integration
proof and why grouping related remaining work is unsuitable. Merely finishing a
card, reusing extensive old implementation or passing many tests is insufficient.
The checker flags these exceptions for substantive review; it cannot judge the
truth or substance of prose. Its `SCOPE_ACCOUNTING_CHECKED` result is never a
bundle certificate, CI/review pass, merge permission or real acceptance proof.
If a planned outcome turns out small, retain that plan and delivery as a
contribution. Plan related additional scope in its existing selected execution
card before coding; compare each preserved plan and review the combined NEW
workload before counting this bundle once. A contribution report may correctly
remain CONTINUE_BUNDLE; it is not a separate bundle or a failed implementation. Never shrink away unfinished scope, pad code or
invent approval.

Use focused checks while assembling; run all required publication/CI/review gates
on the substantial coherent tree. Split only for a concrete migration, dependency,
safety or reviewability reason, keep all guards distinct and count the bundle once.
If insufficient related approved engineering remains, show the inspected scope and
ask the smallest necessary owner decision while continuing independent eligible
work. Actual execution limits require an explicitly INCOMPLETE recoverable handoff.
Maintenance/review-only requests (including this owner-requested workflow repair)
claim zero product bundles and need no fabricated implementation bundle plan.
For already-started work, preserve it, record the current baseline and plan remaining
work now; never fabricate a pre-code plan for work already performed.

**Acceptance and blockers remain additional obligations.** Test each eligible check
against actual deployed ancestry, even when main is ahead. An unavailable TEST
principal, original fixture ownership, runner or optional provider consent is a
specific dependency to investigate, not a blanket acceptance deferral. Record the
exact check, current evidence, attempted remedy, needed action/authority, responsible
party and re-entry trigger. “Coordinate with the runner” alone is not a remedy:
actually coordinate when authorized, or ask the owner the exact actionable question
in the active chat. Do not copy credentials, take over another runner's rotating
grant, recreate uncertain fixtures or bypass approval to clear that dependency.
Continue independent engineering while it remains blocked. Final reporting includes
checks actually performed and actionable remaining prerequisites, not merely
“deployment-dependent checks queued.” Use existing queue/handoff records.

## Count complete predefined batch subsections

The PR workload target is 2–5 whole predefined batch subsections on average,
using the existing roadmap/design IDs such as H-3 or B-5. Technical slices,
functions, tools, UI hookups, guards and packet checklist tasks are internal
implementation steps, not countable batch subsections. List the subsection IDs
and full scope before coding. Partial subsections count zero; count each once
when eligible engineering and required pre-merge proof are complete, with
external acceptance tracked separately. Use focused checks while building,
then the full required gates on the substantial assembled PR. See the governing
instructions' **PR workload is measured in predefined batch subsections** rule.

## 0. Reconcile and recover

Read the governing instructions and the current permanent handoff, not historical
status entries as new work. Verify actual main, live, the READY production revision,
open/unfinished PRs, exact-head CI and unresolved reviews. Preserve concurrent work.
Recover your interrupted/red PR first; inspect all failures and batch their remedies.

## 1. Catch up released work before new implementation

Fetch main/live refs and independently verify the actual serving production origin,
source SHA and READY state. Workflow success, branch equality or a service self-report
alone is insufficient. Run `npm run session:status -- --deployed FULL_SHA --state READY`
with those observations, or use the same ledger and exact GitHub compare/deployment
evidence manually when no shell is available. The command is read-only: it does not
execute acceptance, release software or authorize provider operations.

Evaluate EACH outstanding check against its required revision in deployed ancestry.
Main/live equality is never a global acceptance prerequisite. Perform every currently
eligible authorized check before selecting new implementation; recheck BLOCKED rows
against current decisions and attempt authorized remedies. Defer only the affected
check with its exact missing prerequisite, investigated remedy and next action.
Missing history means fetch/compare that revision; it does not mean “not released.”
Preserve valid evidence until relevant changes invalidate it. Reading the queue or
observing a release is not acceptance execution. Preserve fixture and cleanup gates.

Reconcile all outstanding queue rows, including rows hidden by an output limit, in
the existing ledger/handoff. Before new implementation and final reporting, validate
that accounting with `npm run session:status -- --deployed FULL_SHA --state READY
--acceptance-review /tmp/acceptance-review.json`. This temporary sanitized extract
is not a second ledger and must not contain secrets, provider bodies or private IDs.
It contains the printed `snapshot` digest, `deployed`, `deploymentState`, and `tasks`; every outstanding task needs
`id`, `requiredRevision`, current planner `disposition`, `outcome` and `evidence`.
Use `PERFORMED` with `result: PASS|FAIL` (and `nextAction` for FAIL), or `DEFERRED`
with `prerequisite`, `remedy` and `nextAction`. Existing recorded passes need no
retyping; optional `REUSED` entries reference their evidence. The checker requires a verified READY deployed revision and rejects
omissions or changes to any queue field via the snapshot digest; it cannot attest evidence truth or grant permission.
Without a shell, put the same item-by-item accounting in the permanent handoff.
Record actual results in the existing ledger; rerun the extract after ledger changes.
An inaccessible deployment/evidence source requires investigation and a specific
checkpoint, not fake observations or a project-wide stop.

Recheck at observed releases/configuration changes, after meaningful merges, and
before final handoff. A scheduled, delayed, recovery or separately authorized manual
release uses the same per-check procedure. Follow the checked release policy; never
initiate a release just to finish a development bundle.

## 1a. Choose a substantial outcome

Read the authoritative work index/roadmap and the highest-priority eligible card.
State its observable result and finite acceptance before editing. Read only its named
code seams, design sections and fixtures; reuse existing helpers and task/packet tools.
Group compatible adjacent roadmap slices into a complete usable workflow,
including callers, real integration and tests. Across a rolling five merged
substantive implementation PRs (or fewer if not yet available), target an
**average 400–800 changed production-code lines** and **2–5 fully completed
batch subsections per PR**. These are advisory averages, never per-PR quotas:
a smaller coherent outcome or larger inseparable one is valid; do not
pad code, merge unrelated risks or split features to match them. Production
lines exclude tests, docs, fixtures and generated code. Cite each completed
slice ID from the existing card, with finished eligible engineering,
integration and required checks; record live external acceptance separately.
Use existing PR diffs and permanent handoffs to calculate the averages,
without starting a second tracker. Larger cohesive PRs require extra
integration/risk/verification coverage. Preserve actual migration ordering,
risk isolation and every business/security/financial decision gate.
Do not revisit passing hardening without a demonstrated defect or approved requirement.

## 2. Finish the current roadmap outcome

Use the approved order, active card/packet and parent outcome from actual main.
Before coding, turn that outcome's remaining engineering into one finite checklist:
provider/domain behavior, callers/registry/doors or UI, failure/denial/replay paths,
fixtures and integration proof. Reuse the card; do not create another roadmap.
Complete that eligible integration before selecting later dependent units.
Helper completion, PR numbering and easier tickets do not establish outcome completion.

Investigate technical problems and inherited reviews in this unit; batch authorized
remedies rather than carrying implementable fixes as external acceptance. If an
essential owner-specific policy, fact or permission is missing, check recorded decisions
first, then ask the smallest precise question now with a recommendation and consequences.
Pause only its dependent path, record the answer and resume the same outcome/session.
Research public provider contracts independently; do not ask the owner to resolve them.
Where existing gates permit, continue safe configurable implementation while actual
activation/provider/professional acceptance remains separately restricted. Never invent
approval, widen permissions or mark unimplemented code as waiting for a release.

At handoff, name the same unfinished outcome unless its eligible engineering has proof.
Move to independent work only when the roadmap permits it; preserve genuine execution
limits, risk boundaries, approval gates and the existing release acceptance queue.

## 3. Build, verify, publish

Use focused behavioral tests/lint at meaningful seams while developing. Local commits
are recovery points, not reasons to run the entire suite or push after every small edit.
Before publishing the coherent tree, run all existing mandatory checks and applicable
unit/database/provider-shape/browser gates once. File changes invalidate affected proof.
On a shared limited runner, cap Vitest workers (for example `--maxWorkers=2`) and
run at most two full suites concurrently; preserve the same test selectors/coverage.
Batch known CI/review fixes; inspect all failed jobs before the next correction push.
While CI waits, advance the approved immediate successor; at most two unmerged PRs.
Follow existing REST/Sandbox fallbacks if local execution is unavailable; report actual
Actions evidence honestly. Merge only exact-head green checks plus required reviews.

### First-pass validation and review

Before the first publication of a coherent change, use the existing card/packet to
name each changed boundary, its proving test/fixture and the existing command that
checks it. Keep this compact; reuse the PR's verification section, not a new ledger.

- Trace inputs through the actual caller, helper/client, provider request and result.
  Verify method, path/version, scopes, query/body fields, pagination and response shape
  against the pinned schema/SDK or cited current provider contract **before** adapting
  fixtures. Test the captured outbound request; a permissive fake is not contract proof.
- Reuse realistic fixtures with required fields and relationships. Assert meaningful
  results, denied paths and applicable provider failures/ambiguous writes; prove no
  unintended call or replay. Never weaken a fake/assertion just to turn CI green.
- Search changed exports and data shapes for affected callers, fakes, DB adapters,
  catalogs and tests; update them together. Run existing repository/index/schema/catalog
  validators plus the affected behavioral tests before the full publication gates.
- Review the complete diff against the card and applicable security guide before
  opening the PR. Inspect inherited unresolved findings and all current review threads;
  record each fix or evidence-backed disposition under the repository's review rules.
  A reply alone does not resolve a finding; recheck reviews immediately before merge.
- When CI fails, collect every completed failing job/annotation and trace the root
  cause before one correction push. Reproduce with the smallest relevant existing
  command; retain a regression test for an actual behavioral defect. A repeated failure
  requires new diagnostic evidence, not another speculative fixture edit.

Record exact commands, results and unavailable checks truthfully in the PR. REST-only
sessions still inspect contracts, fixtures and the full diff before publication, then
use required exact-head Actions evidence for execution they cannot perform locally.
Do not invent commands, relax coverage or merge gates, or rerun unchanged passing checks
unless changes or new evidence invalidate them. Live proof remains in the release queue.

Use `npm run check` and affected tests; contract, CLI and DB changes also
need the existing `test:conformance`, `test:doors` and `test:db` gates respectively.
Verify generic routing/auth/results across affected doors without provider handlers.

**PR merge readiness and product acceptance are separate.** A safe implementation PR
may merge with deployment-dependent proof queued, when all pre-merge gates pass and
no explicit card/owner rule requires that proof before merge. Keep such a milestone
IN_PROGRESS/awaiting acceptance. An explicit pre-merge gate still blocks that PR; move
to independently eligible work. Never mark code/CI as deployed or real-provider proof.

## 4. Maintain one release acceptance queue

The marked JSON block in the authoritative status ledger is the running queue, not a
second roadmap. Preserve existing card IDs/evidence and reconcile older open obligations
into it before declaring the catch-up complete. Keep each task's priority, exact minimum
reviewed source revision, procedure, prerequisites, gates, last evidence and disposition.
`dependsOn` names acceptance tasks that must have recorded genuine PASSED evidence;
source implementation dependencies remain in the existing work index. Split broad seed
rows into exact scenario rows as fixtures/revisions are reconciled. No fake pass entries.
After every meaningful merge, add any new deployment-dependent checks in that PR; pin
its source commit, never a guessed future merge SHA. After a release, execute cleared
checks only when that source is in deployed ancestry. If a permitted squash/rebase
removed the pin, reconcile it to the independently verified merged implementation
commit before handoff; never mark it passed or repin to unrelated code.
Execute cleared checks promptly, record sanitized read/write/denial/readback/cleanup proof, and retain
failed/uncertain fixture recovery tasks. New changes, rollback, authorization or environment
changes reopen affected proof. NEVER copy credentials/private fixture IDs into the queue.

## Anti-stall recovery: a partial source commit is never a stopping condition

When authoring GitHub-hosted code through string patches, never feed literal
replacement strings containing JavaScript `$` patterns (including `$'`)
to `String.replace` directly: these are replacement metacharacters and
can silently duplicate/truncate source. Use a callback replacer, compare
the resulting complete function/file to the intended diff, and run targeted
syntax/import validation before the broad CI gate. Repair confirmed parser
errors at their source, not by weakening tests or discarding valid work.

A pushed branch, a successful helper, a written implementation card, or a
single green focused check is a recoverable checkpoint, **not** a completed
subsection and not the end of the requested session. When work pauses after a
partial seam (e.g. a change-history SQL reader without its MCP, HTTPS, owner
workflow and integration tests), the **very next action** is to reopen that
branch, compare it with current main and open PRs, and finish the same
predefined subsection before starting another. Never recreate the partial
work on a second branch simply because the chat resumed.

Maintain on the active card one short, current **execution pointer** with
branch/head, remaining actual acceptance criteria, check/PR state and next
command/API action. Update it when pausing mid-feature or when a gate fails;
remove or resolve it after the complete source outcome is checked and merged.
If no PR exists, open one only after enough connected source, tests and
failure/recovery coverage exist to make it reviewable; do not end the
session at create-file, create-branch or create-PR. For a red CI run,
inspect actual failed job logs, fix the root cause once, then recheck the
exact head without weakening gates or repeating unrelated passing work.

Before handoff, reconcile all branches and PRs created by this session.
For each unfinished one, either complete/review/merge under the normal gates,
or leave a precise execution pointer and reason grounded in actual external
access, authorization or limits. Return to the remaining approved work if
the preferred path is blocked; don't issue a generic continuation prompt
or report an internal technical step as a finished bundle. The user prompt's
bundle workload remains the target, and all original financial, provider,
security, production and release limits continue unchanged.

## 5. Checkpoint and finish

Before reporting session completion, reconcile the acceptance queue again against
actual deployment and finish its accounting above. Report performed checks/results,
reused proof and each deferred check's exact prerequisite/remedy/next action, alongside
bundle outcomes, subsection IDs, merged PRs, checks/reviews and cleanup. Update existing
status/cards/index and the permanent merged-PR handoff. Reaching N bundles or pushing
a checkpoint does not complete the session while eligible obligations remain.
An actual execution limit requires an explicit incomplete, recoverable handoff.


Keep a short progress note on interrupted branches: head, done/proof, one next action,
CI/review state, successor and exact blocker. Diagnose and attempt authorized remedies
before deferring; isolate the operation and continue approved independent work. Limited
release frequency is planned queued acceptance, never a project-wide stop.
Record an exact re-entry trigger and next action for every true external blocker.
Report implemented source, meaningful automated tests, deployed exact revision and
authenticated end-to-end acceptance separately; retain missing proof as OPEN.

When the current owner specifies N bundles, continue toward that target under
the evidence-backed blocker/limit rule above. Without a specified target, use the
available recoverable context for complete, cohesive roadmap outcomes. Plan for a rolling average
of 400–800 changed production lines and 2–5 completed batch subsections per
substantive implementation PR, without hard caps or filler. Record completed
slice IDs and production-only diff counts in the existing PR/handoff;
keep unaccepted provider/deployment evidence OPEN. The existing
`npm run session:status` now prints remaining approved indexed roadmap
units by status and batch next to, but separate from, release acceptance
obligations. These coarse indexed units do **not** estimate remaining
completed batch subsections or total effort; cite card-specific unfinished slices
when making an estimate. No fixed session PR quota applies. Session count follows only the current owner prompt, with all safety
gates and context recovery intact.
Do not count a passing helper as a completed outcome. After each verified
merge, checkpoint the exact head/CI/reviews, completed slices, implementation
and deployed/real-acceptance state, and one next action. Continue the planned bundle after checkpoints. A demonstrated execution limit
requires an explicitly incomplete handoff with exact recovery action; a clean
checkpoint or speculative context concern does not establish bundle completion.
Persist unfinished work on its existing approved card, not only in chat.
Report completed roadmap slices and acceptance deltas, first-pass CI failures
and correction cycles, not PR count as a productivity metric.
Historical maintenance notes do not redefine the current owner request. Follow its actual scope/target; preserve safety and report genuine execution limits with concrete evidence.
At completed-session end update status/cards/index, verify final main, leave a permanent
handoff on the final merged PR and automatically give a short continuation prompt:
repository + verified handoff + next outcome + queue pointer. Refer to the repository
for rules/order rather than recopying them. Preserve interrupted-session obligations.

## 6. Safety and specialized procedures

Governing instructions, existing PLAYBOOK/hosting rules, owner decisions and the card's
specific safety procedures remain binding. Reuse saved authorized developer connections.
Security, money-out approval, production activation, spend, isolation, exact fixture
cleanup, secret handling and all required local/Actions tests are unchanged.

## RTC fleet acceptance procedure — preserve existing safety pins Mandatory RTC fleet check — every session, until all custom servers pass real acceptance

After §0 and **again before the session handoff**, run the hosted
`node scripts/probe-rtc-fleet.mjs` using the reviewed `docs/rtc-fleet-origins.json` public-host inventory.
`RTC_FLEET_ORIGINS` (JSON alias-to-origin map) may temporarily add a **verified**
new host, but add permanent changes to the tracked inventory in a reviewed PR. Probe Stripe, GitHub, Vercel,
Neon, Google Workspace and any newly added custom MCP server; missing origins
are **unverified**, not omitted. This only performs real deployed
`GET /api/contract` requests. Never substitute GitHub source, a standard
connector or `/api/mcp`. Record HTTP status/RTC version and separate:
unavailable (network/404/503), blocked (401/403, invalid RTC),
unverified (valid manifest but no scoped auth), ready (genuine authenticated
direct read_only test). Even **ready** does not certify encrypted relay,
Vercel Sandbox or revocation: those are separately recorded gates.

If an independently owner-approved temporary non-production RTC TEST
read_only pass is available, set `RTC_FLEET_READ_TESTS` to JSON of
alias → `{ "readTool": "...", "passEnv": "ENV_NAME", "expectedDeployment": { "sha": "<exact 40-hex deployed commit>", "ref": "live", "environment": "production" } }`. First independently verify the exact deployed SHA, branch and environment through the service owner's trusted deployment evidence. These nonsecret pins must all match the service's public `deployment` self-report **before** the fleet checker starts its pass-bearing agent request; an absent, stale or preview claim remains unverified. A matching self-report alone is not an independent deployed attestation or real read. Keep pass bytes only
inside that environment, and invoke `node scripts/probe-rtc-fleet.mjs --authorized-read-only`.
The existing `agent-check` enforces read_only identity, declared non-writing
tool metadata and real harmless read, while requiring an exact direct route.
Never run this opt-in against live/production or a write, never log a pass.
After service owner revokes the exact temporary TEST read_only pass used
for acceptance, verify an **explicit 401 `pass_revoked`** response with
`node scripts/rtc-revocation-probe.mjs --server ALIAS --pass-env ENV_NAME --authorized-revoked-test`.
The pass must be held only in that protected env and must be a revoked
TEST pass. Generic 401/403, a failed network request or a previously denied
credential is not revocation proof. Do not run in production. Save only the
neutral output; the same-pass linkage and owner revocation action require
independent protected acceptance evidence. This verifies direct denial
only, not relay/Sandbox revocation.

Execute separate D-4 private GitHub relay/Sandbox and revocation checks using
their owner-approved secure environments. Capture only neutral evidence in
D-4/STATUS, including source versus deployed status and all unfinished gates.
Keep repeating at both boundaries until every applicable server has **all**
required real acceptance evidence. A failed check does not block unrelated
approved implementation. When this executor cannot reach public hosts, CI's
pinned --public-observe step captures the same read-only contract classifications
on its runner; inspect actual job logs. Network failure is not service failure,
and public observation is never a signed-in route acceptance.
