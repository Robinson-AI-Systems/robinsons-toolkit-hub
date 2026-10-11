# D-1a — Working rtool direct CLI

Status: MERGED (#12), written as if merged per PLAYBOOK Step 6.
Design BATCH-D §1–4, split amendment 2026-10-11. Prerequisite K-2 merged.
Baseline main 8358120a4fc6715997a40984f1c0951d85beffa1.
Risk area direct HTTPS tool access; no database or production migration.
Production budget approximately 450 lines plus behavioral tests.

## Read only these

- RTC CONTRACT sections 1–7; Batch D D1–D3 and D-1 work unit.
- K-2 fake server and its test exports; SESSION-START; AI-PR-READ-FIRST.

## Drift check A

| Assumption | Actual | Kind | Resolution |
|---|---|---|---|
| RTC test fake works | K-2 and K-2b merged | Matches | Use it over real localhost HTTP |
| D-1 would fit one approximately 500-line PR | CLI+SDK+keychain+skill exceed limit | Oversized | Split without dropping acceptance |
| Hub needed for service calls | Contract states no | Matches | Direct calls to each server |

## Build and tests

- Create npm CLI workspace with Node 24 pure ES modules and no runtime dependencies.
- Parse URL-only config and environment-provided server names/passes; never save a pass
  to plaintext config, include it in a URL or show it in error output.
- Routing accepts server.tool qualification and prefixed names; refuse ambiguous prefixes.
- Real HTTPS commands: servers, whoami, tools, describe, call, batch, result.
- Same dryRun/confirm and area constraints are enforced by the service itself.
- List paging and large-result handle materialization stay bounded; private file output is
  a new file with 0600 permissions, never an accidental overwrite.
- Test with the real K-2 HTTP fake: reads, tool search, write guards, confirmation,
  batch refusal, key secrecy, output and exit codes. CI gate must be green.

## Successor D-1 inherits

The complete direct-command surface and safe URL/routing primitives. Add keychain-backed
login, SDK generator, skill and init and cli-v1 release only; keep these tests unchanged.
