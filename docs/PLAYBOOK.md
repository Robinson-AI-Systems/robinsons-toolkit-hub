# PLAYBOOK — how to deliver one PR card, step by step

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
- The hub never calls a service directly: always a server's RTC doors (or the old toolkit as a legacy backend, Batch M).
- No mock data, stubs returning success, or TODO-as-implementation.
- **Ripple check:** `grep -rn "<changed export>" packages api tests | head -50` and update every affected fake and test
  in the same commit.

### Step 3a — PR size

About 500 production lines (tests/docs not counted), about 15 production files, hard stop ~800 lines, at most one
migration, one risk area (passes and secrets / a door / federation / compound workflows / local tools). Measure before opening the PR:

```bash
git diff --shortstat origin/<base>...HEAD -- api packages scripts ':!**/*.test.*'
git diff --name-only origin/<base>...HEAD -- api packages scripts | wc -l
```

## Step 4 — Verify before pushing

### 4a. The quick gate (every push)

`npm run check` = secret scan (`scripts/check-secrets.mjs`), docs check (`scripts/check-docs-updated.mjs`), index
validation (`docs/pr-cards/validate-index.py`), lint. Never `--no-verify`.

### 4b. Add the checks your change needs

| You changed | Run |
|---|---|
| Any package | `npx vitest run packages/<pkg>/test` |
| A door (CLI, local MCP, relay, hub HTTPS) | `npm run test:doors` (local fake RTC server from `packages/conformance`) |
| The contract or the conformance package | `npm run test:conformance` (runs against the reference fake server) |
| SQL | `npm run test:db -- <file>` (`scripts/local-postgres-test.sh`, localhost only) |

### 4c. Registries that break CI when you forget them

`docs/kit/SERVER-ROADMAP.md` (server list) · `packages/hub/servers.js` (known servers, H-2) · `work-index.json`.

## Step 5 — Pushing and CI

1. **Push once per CI cycle.** A push cancels the running CI.
2. **After a red run:** read all failures, reproduce each locally with 4b, fix every failure, push once.
3. **Is it mine?** If the same test is red on `main`, it isn't: port the fix or make a tiny separate fix PR.
4. **Same failure twice:** reproduce locally. **Third red run:** evidence-based diagnosis before any further push.
5. "Flake" is not a cause. Never skip, retry-loop or quarantine.
6. Put "CI runs used: N (red: R, cancelled: C)" in the PR description.

**When `main` moves while your PR is open:** sync once at the PR boundary with `git merge origin/main` — never rebase a
pushed branch. Conflicts in STATUS, MASTER-ROADMAP or `work-index.json`: keep both sides, re-run the validator.

## Step 6 — Docs as if merged, then open the PR

DRIFT-PROTOCOL checklist B (CI checks it): card `MERGED (#n)`, STATUS names the next card, `work-index.json` status,
ARCHITECTURE for env vars/tables, CONTRACT (new version + DECISIONS entry) when the contract changed,
OWNER-INPUTS for new questions, DECISIONS for decisions. PR title `<type>: <plain description>`. Description in plain
English: what Chris can now ask for; acceptance with evidence; owner decisions (IN-xx or none); review dispositions;
what is not included; CI runs used. Delete the resume note in the final commit.

## Step 7 — Review

1. Passes, secrets, doors, relay, federation, compound workflows: re-read `docs/AI-PR-READ-FIRST.md` and write one line per
   applicable constraint in the PR.
2. Freeze scope. There is no automated review in this repo (IN-01): inspect the whole diff yourself against
   AI-PR-READ-FIRST, write "Self-review: …" with every finding and its disposition, and fix all blocking findings in one
   patch.
3. Resolve a thread only after verifying the fix at the exact head.

## Step 8 — Preview

Vercel builds a preview per branch for the hub and relay. Previews never hold a real pass: the hub refuses to register a
server pass on a non-production deployment. For a door or login change, open the preview's home page and confirm the
version and server list shown match the PR.

## Step 9 — Merge (authorized when all are true)

`ci` green at the exact head; acceptance met with evidence; reviews handled. Merge with the expected-head SHA (merge
commits). Stacks merge bottom-up, retargeting each PR to `main` first. After the lower PR merges, sync the successor
once onto final `main`.

## Step 10 — Waiting and stopping

- External waits are checkpoints: check once, act on anything new, then build the immediate successor.
- A quiet bounded CI wait is allowed: at most 60 seconds per wait, 10 minutes total
  (`timeout 300 gh run watch <id> --exit-status --interval 60 > /tmp/ci-wait.log 2>&1`); timeout means pending.
- Before ending a turn: commit, update the resume note and STATUS (exact head, pending gates, next action), and tell
  Chris in plain English.

## If you get stuck

- Same failure after two focused attempts: stop editing, inspect the evidence, change the hypothesis.
- A server does not behave as the contract says: don't work around it in the hub. Record it, open an issue (or a card)
  in that server's repo, propose a contract amendment only if the contract is wrong, continue other work.
- Docs contradict code: tests are the truth for behavior, AGENTS for rules, PLAN for scope, card and design for how.
