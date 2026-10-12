# SESSION-START — one page to begin (or resume) an implementation session

For Sol 5.6 (or any model) implementing a PR card. Read **this page and your card**, then work. Open other rule files
only when a step below names them, a section at a time. `AGENTS.md` still governs; this page is its short form.

## 0. First thing, every session: finish what is already open

Your session can end at any moment (the chat stops between actions), so the next session starts here, not at a new card.

1. `R=$(git remote get-url origin | sed -E 's#.*github.com[:/]##; s#\.git$##')` then
   `gh api "repos/$R/pulls?state=open" --jq '.[]|select(.head.ref|startswith("ai/<tool>/"))|"\(.number) \(.head.ref) \(.head.sha)"'`
   with `<tool>` = your own branch prefix (`sol`, `gpt6`, `claude` …). **Yours** = branches under your own prefix,
   including ones a previous session of yours opened (one agent that used several prefixes, e.g. `sol` and `gpt6`,
   checks each). Another agent's PR is not yours: leave it alone unless Chris asks.
2. For each of your open PRs, first fetch its exact head — `git fetch origin <branch> && git checkout -B <branch>
   FETCH_HEAD`, confirm `git rev-parse HEAD` equals the PR's head SHA — and read its resume note (§4). Then check `ci`
   at that head
   (`gh api "repos/$R/commits/<sha>/check-runs" --jq '.check_runs[]|"\(.id) \(.name) \(.conclusion)"'`).
   - **Red → that is your task now.** Read every failure (job logs may not download; use
     `gh api "repos/$R/check-runs/<id>/annotations"`), reproduce locally, fix all of them, push once, re-check.
   - **Green and acceptance met → bring it up to date, then merge** (PLAYBOOK Steps 5 and 9): if
     `gh api "repos/$R/compare/main...<sha>" --jq .behind_by` is above 0, `git fetch origin main && git merge origin/main`,
     run the checks, push, and merge only when `ci` is green at that new head. **Pending →** build the next slice meanwhile.
   - Review threads open → fix or answer each, then resolve.
3. Continue from the resume note's "Next step". Only when nothing of yours is open: §1 and the next card.

## 0a. Mandatory RTC fleet check — every session, until all custom servers pass real acceptance

After §0 and **again before the five-PR handoff**, run the hosted
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

## 0b. Outcome and blocker triage

Follow AGENTS' **Outcome-first autonomous development** policy before choosing
new PRs: identify the next eligible capability milestone and finite remaining
acceptance, recheck deferred items after owner/service/deployment changes, and
keep code, original-source tests, deployed exact commit and authenticated real
acceptance separate. Do not mistake five PRs for milestone completion. Before declaring any milestone
blocked, investigate and attempt authorized code/config/dependency/doc/owner-input
remedies; isolate only truly external evidence/permissions, then scan the actual
approved index for independently eligible work and implement it. Do not stop at
a recorded blocker or re-request approved IN-xx authority. Requeue deferred
items immediately when real evidence arrives. An early stop requires proven
absence of remaining safe approved work or a specific execution limitation. Update
the permanent final-PR handoff and generate the same concise outcome-first
continuation prompt every session.

## 1. Find your place (2 minutes)

Work happens in whatever workspace you were given (a cloud agent workspace, a Vercel Sandbox, a laptop). Code reaches
GitHub only as git commits pushed to an `ai/*` branch. Never copy source files through tool output.

1. `git fetch origin main:refs/remotes/origin/main && git status -sb && git log --oneline -5`; `npm ci` once per
   checkout (Node 24.x; an older local Node only warns).
2. `sed -n '1,40p' docs/STATUS.md` → the **Next** section names the card.
3. Resume note? `ls docs/pr-cards/*.progress.md 2>/dev/null` — if your card has one, continue from its "Next step".
   Do not restart work it lists as done.
4. Read your card (`docs/pr-cards/<ID>.md`). If the roadmap says JIT (no card yet), write it first from the design
   (`docs/pr-cards/README.md`, 40–100 lines). Read only what the card's "Read only these" list says.
   For a new card, use [IMPLEMENTATION-GUIDE §2](implementation-contracts/IMPLEMENTATION-GUIDE.md#2-the-executable-card-packet)
   and its §1 route table; read only the section matching your unit. K-3 starts at §6.

## 2. Never do these without Chris (AGENTS "Hard limits")

Using a real pass against a production or live account from tests or scripts; buying anything; a secret anywhere in
code, docs, tests, logs, PR text or tool results; changing a service server's repo outside that repo's own cards;
widening default pass permissions; committing to `main`; skipping, disabling or weakening tests.

## 3. The work loop

1. Branch `ai/<tool>/<topic>` from latest `main` (or the card's base).
2. Drift check: `docs/implementation-contracts/DRIFT-PROTOCOL.md` **checklist A** (table in the PR, card corrected
   first).
3. Build one work unit → its tests → run them (`npx vitest run <files>`; `npm run test:db -- <file>` when it touches
   SQL; `npm run test:conformance` once K-2 has added it, when it touches a door or the contract) → `npm run check` and
   `npm test` → **commit locally** → update the resume note (§4). Repeat. Red → fix one failing file at a time, then
   the full check once.
4. **Code first, then docs.** In an implementation PR, edit only the docs checklist B names.
5. When the card is complete: update the docs **as if this PR had already merged** (card `MERGED (#n)`, STATUS,
   `work-index.json`, ARCHITECTURE when infra changed, CONTRACT when the contract changed — checklist B), push once, open the PR
   **through the REST API** (PLAYBOOK Step 6 has the exact command; `gh pr` is often blocked), wait for CI with the
   bounded wait in PLAYBOOK Step 10 (the merge gate is the check named `ci`; failed jobs' annotations show the errors),
   write the self-review, then merge with the exact head SHA (Steps 7–9).

### GitHub REST fallback for constrained environments (permanent)

When the active workspace cannot clone GitHub, has no usable Git checkout or terminal,
or cannot reach github.com (including DNS/network restrictions), **use the authenticated
GitHub REST route** rather than retrying blocked shell or CLI commands. The GitHub
connector's repository/branch/file/PR/check-run operations are an acceptable REST
transport for staged changes and evidence. Keep all normal branch, reviewer, scope,
owner approval and exact-head CI gates; this changes transport, not policy.

1. Verify GitHub `main` and open PRs with REST metadata, and inspect existing
   branches, review threads, required files and check-run results before editing.
2. Create an `ai/<tool>/*` branch from the verified exact main commit. Use REST
   file writes with existing blob SHA preconditions; never write to main directly.
3. Make a small coherent edit with tests. If local Node/npm/Postgres cannot execute,
   **do not claim local validation**: open a draft PR and use CI at the exact branch
   head as the execution environment, including disposable PostgreSQL jobs.
4. For failures, inspect CI annotations and job summaries/logs through REST,
   correct every actionable failure on the branch and wait for the new exact-head
   checks. Do not merge if required checks are missing, pending or red.
5. Record the unavailable local command, the exact CI run/head evidence, the
   reviewed diff, unresolved threads and resume point in the PR/card. Complete
   the ordinary self-review and merge only with exact-head SHA protection.

Do not interpret a network-restricted checkout as authorization to use production
credentials or external production services for testing. No synthetic green status,
no skipping regression/DB checks, and no workaround that weakens safeguards.

## 4. Resume note — so stopping never loses your place

Keep `docs/pr-cards/<ID>.progress.md` (≤20 lines) on your branch and update it after every commit:

```
Card: D-1 · Branch: ai/sol/d-1-rtool · Last commit: <sha> <subject>
Done: 1 server config + keychain (tests pass) · 2 whoami/tools/describe
Next step: 3 call with --out — write the file writer, then its unit test
Blocked: none
```

Delete it in the card's final commit.

## 5. Anti-stall rules (AGENTS "Working without stalling" — mandatory)

- Files over ~300 lines by section only (`grep -n` the heading, then `sed -n 'A,Bp'`, ≤150 lines). Never read
  `docs/CONTRACT.md` past the section you need.
- Every search has a path and `| head -50`. Only commands that finish by themselves; `timeout 600` for slow ones.
- Pipe long output through `| tail -80`. Same command fails twice → change approach or record the blocker.
- After ~10 reads/searches without an edit, make the smallest next edit.
- CI and reviews: check once, act on what is new, then do other work.

## 6. Keep moving: problems are not blockers

| Engineering problem — **fix it yourself, never stop** | Real blocker — stop and ask Chris |
|---|---|
| Red CI, lint errors, a failing or outdated test, a wrong API parameter, a merge conflict, a failure that "looks flaky", unclear existing code, a missing card (write it), docs that disagree with code, a card that is too big (split it and record the split) | A hard limit (§2); an owner decision (`IN-xx`) the **current step** truly needs; a design that cannot work (write a dated amendment, then continue other work while it waits) |

**Validate in thin slices.** Write the smallest piece plus its test, then run that test and lint the files you touched
(`npx vitest run <file>`, `npx eslint <files>`) **before** writing the next piece. Never write more than about 150
production lines without running tests. Look up every external API parameter before coding it — in the vendored API description
(`node scripts/openapi-find.mjs "<words>"` once it exists), or, for calls the design routes through a pinned official
package instead, in that package's types and documentation — a wrong parameter is the most common CI failure.
Run the full `npm run check` and `npm test` before every push: CI should only confirm what you already know.

**No shell?** If your workspace cannot run commands (you edit through a GitHub connector), you cannot validate locally:
open the PR as a **draft** after the first slice and push **each slice once the previous run has finished** — CI is
your test runner (this replaces "one push
per CI cycle"). Read failures from check-run annotations and fix them before adding the next slice.

**CI cadence: one complete run per fix batch.** Every push starts a full CI run, and that is intended: the merge gate
must be green at the exact head, because a fix in one place can break another. So make each run count:
- **Never push while your PR's CI run is still in progress.** Wait for every job to finish (PLAYBOOK Step 10's bounded
  wait; build the next slice locally meanwhile), collect **all** failures, fix them together, then push once.
- Run the checks locally first whenever you can (`npm run check`, `npm test`, and the db/mock tests the change touches),
  so CI confirms rather than discovers.
- "Re-run failed jobs" on GitHub is only for an infrastructure hiccup with no code change (a runner or network error);
  any code change gets a full run.

**Leave an exact recovery point.** Never end a turn with a plan, a promise ("I'll now …") or a summary while work
remains. End every turn right after a push whose resume note's "Next step" is the exact next action — a command or a
file and function, e.g. "CI red at 8adb4bf: `tests/unit/billing.test.js` expects old message; update it, then lint
`src/tools/billing.js`".

**Stopping** happens only for a real blocker. Before stopping: update the resume note and `docs/STATUS.md`, then
commit and push them with the work, and say in one plain-English paragraph what is done and exactly what Chris needs to decide.

## Restart message for Chris to paste when a session stops

> Continue the Robinson's Toolkit work. Read `docs/SESSION-START.md` and do §0 first: finish any open PR of yours (fix red
> CI, then merge) before starting the next card. Then keep going card after card; stop only for a real blocker (§6).
## 7. Fast path (K-3ar)

After §0 and the relevant card, use [DEVELOPMENT-EFFICIENCY](implementation-contracts/DEVELOPMENT-EFFICIENCY.md)
for the verified code paths, targeted fixture groups, acceptance and safe PR batching. To avoid repeating
research, read only the applicable row; run `npm run test:focus -- upstream`, `release`, `auth`, `adapter`
or `core` while building. This never replaces final full gates. Preserve the two-lane conveyor and
reconcile review findings before merging.
