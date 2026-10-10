# SESSION-START — one page to begin (or resume) an implementation session

For Sol 5.6 (or any model) implementing a PR card. Read **this page and your card**, then work. Open other rule files
only when a step below names them, a section at a time. `AGENTS.md` still governs; this page is its short form.

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

## 6. Stopping

Stop only for a real gate: a hard limit (§2), a missing money/security/schema decision, or a card over 800 production
lines. Before stopping: commit, update the resume note and `docs/STATUS.md`, and say in one plain-English paragraph what
is done and what Chris needs to decide.

## Restart message for Chris to paste when a session stops

> Continue the Robinson's Toolkit work. Read `docs/SESSION-START.md`, then your card's resume note
> (`docs/pr-cards/<ID>.progress.md`) if it exists, and pick up at its "Next step". Follow the anti-stall rules.
