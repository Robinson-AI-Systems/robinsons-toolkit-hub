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


## Bundle target and delivery boundaries — owner alignment 2026-10-15

Follow the governing instructions' **Bundle, card and PR boundaries** rule.
The current owner's N-bundle target counts coherent completed outcomes, not PRs,
cards, helpers or repairs. Select related whole approved subsections before coding.
Card/API/module boundaries and the number of related migrations or risk areas do
not force separate PRs. Preserve each independent guard, permission, confirmation,
migration-order and verification requirement. Record a concrete migration,
dependency, safety or reviewability reason for splitting; count the bundle once
when its whole intended outcome is implemented, verified and merged.

An incidental repair or green PR is a checkpoint, not completion of the bundle
or session target. Resume eligible implementation after it. A pending release or
professional/provider approval gates its actual affected operation, not independent
engineering. Before claiming no eligible work, inspect the full original acceptance
against current code/callers/tests and record the exact remaining engineering or
source/test proof plus external gate. Ask promptly for genuinely missing owner
choices/authority after checking recorded decisions; continue independent work.
If the approved scope cannot support N substantial outcomes, explain with that
evidence while working and obtain the necessary owner scope decision. Never pad,
recount prior work, silently downgrade the target, invent new scope or bypass gates.
A real execution limit needs concrete evidence, a recoverable checkpoint and the
exact resume action; generic context caution is not a routine stopping permission.
Reuse existing verified evidence until relevant changes invalidate it; do not turn
this into repeated whole-repo audits, extra gates or full suites after each helper.

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
It contains `deployed`, `deploymentState`, and `tasks`; every outstanding task needs
`id`, `requiredRevision`, current planner `disposition`, `outcome` and `evidence`.
Use `PERFORMED` with `result: PASS|FAIL` (and `nextAction` for FAIL), or `DEFERRED`
with `prerequisite`, `remedy` and `nextAction`. Existing recorded passes need no
retyping; optional `REUSED` entries reference their evidence. The checker rejects
omissions and stale snapshots; it cannot attest evidence truth or grant permission.
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
and deployed/real-acceptance state, and one next action. Start another slice
only when the remaining context can support its implementation, review, CI
repair, merge and durable handoff; otherwise end at the clean checkpoint.
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
