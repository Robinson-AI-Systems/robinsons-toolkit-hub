# PLAYBOOK — how to deliver a coherent implementation bundle

Session startup, cadence and release-dependent proof follow `docs/SESSION-START.md`. These recipes preserve all existing security, review and validation gates. Run focused checks at coherent seams and full required gates before publishing, rather than the whole suite after each small local edit.

The rules are in `AGENTS.md`; the short start is `docs/SESSION-START.md`; the work is the card in `docs/pr-cards/`.
Same procedure as the Stripe MCP's PLAYBOOK (itself from Appliance Desk), adapted to the hub.

## Step 0 — Orient (minutes, not a reading session)

1. `git fetch origin && git status -sb`. Resume the branch/PR in `docs/STATUS.md` (and the card's resume note) before
   starting anything new. Never discard local work.
2. Read the card. If the roadmap row says JIT, write the card first from the design and current code
   (`docs/pr-cards/README.md`). A missing card is work, not a reason to stop.
3. Read only what the card names, a section at a time.
4. Check `docs/OWNER-INPUTS.md` only for inputs this card needs. Build what doesn't depend on a missing answer; keep
   the dependent behavior off; list the ID.

## Step 0b — Drift check (every card)

`docs/implementation-contracts/DRIFT-PROTOCOL.md` checklist A before coding; B inside the PR; C at batch end.

## Step 1 — Branch

`git checkout -b ai/<tool>/<topic>` from current `main` — or from the unmerged predecessor's branch when stacking.
At most two unmerged implementation PRs in one chain.

## Step 2 — Inventory before coding

`grep` the package (`packages/<pkg>/src`, `api/`, `tests/`). Reuse `robinson-mcp-core` helpers once K-3 exists. For any
behavior a server must provide, read that section of `docs/CONTRACT.md` first and cite it in the PR.

## Step 3 — Implement in ordered commits

One work unit = one local commit. Inside it: (1) additive SQL + `docs/ARCHITECTURE.md` row if the database changed;
(2) the code with its unit tests in the same commit; (3) conformance or door tests when a door is involved.

While implementing:
- The hub never calls a service directly: always a server's RTC doors.
- No mock data, stubs returning success, or TODO-as-implementation.
- **Ripple check:** `grep -rn "<changed export>" packages api tests | head -50` and update every affected fake and test
  in the same commit.

### Step 3a — PR size

Normally average 2–5 complete predefined subsections and 400–800 meaningful
production-code lines per coherent bundle; tests/docs/generated/formatting are
excluded. These are planning averages, not hard ceilings, minima or filler quotas.
Cards define approved scope, not mandatory separate PRs. Group connected domain,
caller, persistence and recovery behavior; different modules/APIs and multiple
related migrations or risk areas do not automatically require splits. Keep each
risk/permission/confirmation and denial path independently enforced and tested.
Related additive migrations require explicit order and upgrade/restore proof.
Prefer one substantial PR per bundle. Split only for a concrete migration,
dependency, safety or reviewability reason, document remaining integration and
count the full outcome once after all parts are implemented, verified and merged.
No unrelated scope, new permission or actual activation is authorized by grouping.
Measure before publication:

```bash
git diff --shortstat origin/<base>...HEAD -- api packages scripts ':!**/*.test.*'
git diff --name-only origin/<base>...HEAD -- api packages scripts | wc -l
```

## Step 4 — Verify before pushing

### 4a. The quick gate (every push)

`npm run check` = secret scan (`scripts/check-secrets.mjs`), docs check (`scripts/check-docs-updated.mjs`), index
validation (`docs/pr-cards/validate-index.py`), lint. Then `npm test` (unit). Never `--no-verify`. The docs check
compares with `origin/main`: in a shallow clone run `git fetch origin main:refs/remotes/origin/main` first.

### 4b. Add the checks your change needs

| You changed | Run |
|---|---|
| Any package | `npx vitest run packages/<pkg>/test` |
| A door (CLI, local MCP, relay, hub HTTPS) | `npm run test:doors` (added by D-1; local fake RTC server from `packages/conformance`) |
| The contract or the conformance package | `npm run test:conformance` (added by K-2; runs against the reference fake server) |
| SQL | `npm run test:db -- <file>` (`scripts/local-postgres-test.sh`: CI's Postgres service, or a throwaway local cluster; without local Postgres it exits 2 and CI's `db` job is the proof) |

Database tests build on `tests/db/isolated-schema.js` (one throwaway schema per file; `pool()` opens an independent
pool — a second serverless instance sharing the database).

### 4c. Registries that break CI when you forget them

`docs/kit/SERVER-ROADMAP.md` (server list) · `packages/hub/servers.js` (known servers, H-2) · `work-index.json`.

## Step 5 — Pushing and CI

CI (`.github/workflows/ci.yml`) runs jobs `check`, `unit`, `db` and the aggregate **`ci`**, which fails unless every
other job succeeded. `ci` is the only check that decides a merge.

1. **Push once per CI cycle, and never while your PR's CI run is still in progress** (SESSION-START §6 "CI cadence"):
   wait for every job, collect all failures, fix them together, then push. In a shallow clone run `git fetch origin main` first.
2. **After a red run:** read all failures, reproduce each locally with 4b, fix every failure, push once.
3. **Is it mine?** If the same test is red on `main`, it isn't: port the fix or make a tiny separate fix PR.
4. **Same failure twice:** reproduce locally. **Third red run:** evidence-based diagnosis before any further push.
5. "Flake" is not a cause. Never skip, retry-loop or quarantine.
6. Put "CI runs used: N (red: R, cancelled: C)" in the PR description; C should be 0 — a cancelled run means a push
   arrived during a run.

**When `main` moves while your PR is open:** sync once at the PR boundary with `git merge origin/main` — never rebase a
pushed branch. Conflicts in STATUS, MASTER-ROADMAP or `work-index.json`: keep both sides, re-run the validator.

## Step 6 — Docs as if merged, then open the PR

DRIFT-PROTOCOL checklist B (CI checks it): card `MERGED (#n)`, STATUS names the next card, `work-index.json` status,
ARCHITECTURE for env vars/tables, CONTRACT (new version + DECISIONS entry) when the contract changed,
OWNER-INPUTS for new questions, DECISIONS for decisions. PR title `<type>: <plain description>`. Description in plain
English: what Chris can now ask for; acceptance with evidence; owner decisions (IN-xx or none); review dispositions;
what is not included; CI runs used. Delete the resume note in the final commit.

**Open it through the REST API** (`gh pr …` uses GraphQL, which agent workspaces often block):

```bash
gh api repos/Robinson-AI-Systems/robinsons-toolkit-hub/pulls -f title='<type>: <description>' \
  -f head=ai/<tool>/<topic> -f base=main -F body=@/path/to/pr-body.md --jq '.number,.html_url'
gh api -X PATCH repos/Robinson-AI-Systems/robinsons-toolkit-hub/pulls/<n> -F body=@/path/to/pr-body.md   # edit later
```

End the body with the attribution lines your session gives you.

## Step 7 — Review

1. Passes, secrets, doors, relay, federation, compound workflows: re-read `docs/AI-PR-READ-FIRST.md` and write one line per
   applicable constraint in the PR.
2. Freeze scope. There is no automated review in this repo (IN-01): inspect the whole diff yourself against
   AI-PR-READ-FIRST, write "Self-review: …" with every finding and its disposition, and fix all blocking findings in one
   patch.
3. Resolve a thread only after verifying the fix at the exact head.

## Step 8 — Preview

Once the Vercel project exists (IN-02; none yet), Vercel builds a preview per branch for the hub and relay. Previews never hold a real pass: the hub refuses to register a
server pass on a non-production deployment. For a door or login change, open the preview's home page and confirm the
version and server list shown match the PR.

## Step 9 — Merge (authorized when all are true)

`ci` green at the exact head; acceptance met with evidence; reviews handled. Merge with the expected-head SHA (merge
commits). Stacks merge bottom-up, retargeting each PR to `main` first. After the lower PR merges, sync the successor
once onto final `main`.

## Step 10 — Waiting and stopping

- External waits are checkpoints: check once, act on anything new, then build the immediate successor.
- A quiet bounded CI wait is allowed: one `sleep 60` per command, then one status read, at most ~15 minutes in total;
  still pending after that means a checkpoint (write it in STATUS and do other work), never a longer loop:

  ```bash
  R=repos/Robinson-AI-Systems/robinsons-toolkit-hub
  SHA=$(git rev-parse HEAD)
  sleep 60; gh api "$R/commits/$SHA/check-runs" --jq '.check_runs[]|[.name,.status,.conclusion]|@tsv'
  ```

  Done when every row is `completed`; the merge gate is the row named `ci` with conclusion `success`. The run URL for
  the PR is `gh api "$R/actions/runs?head_sha=$SHA" --jq '.workflow_runs[0].html_url'`.
- **Reading a failure** without downloading logs: the failed row's annotations carry the error lines —
  `gh api "$R/check-runs/<check-run id>/annotations" --jq '.[]|[.path,.start_line,.message]|@tsv'` (the id is
  `.check_runs[].id` above). Reproduce locally with the 4b command for that job before changing anything.
- Merge (Step 9) with the exact head: `gh api -X PUT "$R/pulls/<n>/merge" -f sha=<head sha> -f merge_method=merge`,
  then one bounded check that the push-to-`main` run of `ci` is green.
- Org-wide automated reviewer (if it posts anyway): list `gh api "$R/pulls/<n>/comments"`, reply
  `gh api -X POST "$R/pulls/<n>/comments/<id>/replies" -f body='…'`, resolve after the fix is at the head.
- Before ending a turn: commit, update the resume note and STATUS (exact head, pending gates, next action), and tell
  Chris in plain English.

## If you get stuck

- Same failure after two focused attempts: stop editing, inspect the evidence, change the hypothesis.
- A server does not behave as the contract says: don't work around it in the hub. Record it, open an issue (or a card)
  in that server's repo, propose a contract amendment only if the contract is wrong, continue other work.
- Docs contradict code: tests are the truth for behavior, AGENTS for rules, PLAN for scope, card and design for how.
