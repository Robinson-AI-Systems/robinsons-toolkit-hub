# D-1b — Typed SDK and safe agent setup

Status: MERGED (#13) (as-if-merged for PR CI).
Approved BATCH-D §1 D2/D5, §4 D-1 plus 2026-10-11 amendment.
Prerequisites K-2, D-1a merged (#10, #12).
Baseline 6de0e265fce91bdfb326ed0d0d773f982caf887c.
Risk: generated executable code, directory writes and agent guidance.
Budget: below the 450–800 production range because secure keychain login was
deliberately isolated to D-1 to avoid bundling distinct trust boundaries.

## Read only these

- docs/CONTRACT.md §§2–7; docs/designs/BATCH-D.md §§1,4; D-1a card.
- packages/cli/src/{config,dispatch,pages,commands}.js and reference fake server.
- AGENTS.md / docs/SESSION-START.md / docs/AI-PR-READ-FIRST.md.

## Drift check A

| Card assumption | Actual | Kind | Action |
|---|---|---|---|
| Direct HTTPS CLI exists | #12 green | Match | Reuse config and dispatch |
| OS keychain is present | Not implemented | Planned | Keep in security-specific D-1 |
| SDK should never persist a pass | Contract §2 | Security | Runtime reads env, never serializes pass |
| Real relay available | No relay deployed | Blocked external | Document direct only; no false fallback |

## Build and tests

- rtool sdk ALIAS --out FRESH_DIRECTORY fetches the live catalog and writes per-area
  ES modules, generated TypeScript declarations and a shared direct HTTPS client.
  Refuse unsafe tool identifiers, duplicate names, huge catalogs and output overwrite.
  Never write a pass. Test actual generated read and guarded write over local RTC HTTP.
- rtool skill outputs static guidance, or installs a no-overwrite SKILL.md file;
  rtool init manages only a marked section of project AGENTS.md, preserving all
  unowned instructions, rejecting symlinks and malformed markers. No false relay claims.
- sdk-setup tests cover runtime calls, types, missing routing, updates/idempotency,
  symlink refusal and secrecy. npm run check, npm test and db tests green in CI.

## Successor D-1

Secure OS-keychain-backed login on supported hosts, TypeScript compiler conformance,
final combined CLI check script and verified cli-v1 tag. Do not duplicate SDK/setup.
