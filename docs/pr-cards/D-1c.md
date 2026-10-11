# D-1c — Secure OS keychain login

Status: MERGED (#14) as-if-merged per repository instructions.
Prerequisites: D-1b (#13). Baseline main 921ab17366ab6fafb0ca98f73e776ae897d37eaa.
Risk area OS credentials, secret transport and native subprocesses.
Budget: under 450 production lines because this is an isolated security boundary.

## Read only these

- RTC CONTRACT sections 1 and 2; BATCH-D D1–D3; AI-PR-READ-FIRST.
- CLI configuration, HTTP dispatch, existing CLI tests, SESSION-START.

## Drift check A

| Assumption | Actual | Kind | Correction |
|---|---|---|---|
| Direct CLI and SDK built | D-1a/b merged | Match | Extend them |
| Pass can be stored as text | Contract prohibits | Security | OS keychain only |
| Native manager exists on every host | Headless CI may lack it | Capability | Isolate missing manager |
| CI can test real Windows/macOS devices | CI uses Ubuntu | Limitation | Mock plans, record field smoke |

## Build, acceptance, successor

- Native Linux Secret Service, macOS Keychain, Windows Credential Manager; credential
  values never enter process arguments, configuration JSON or disk files from this CLI.
- Keychain process environment is sanitized. Secret handed over stdin, and child
  stderr never echoed. Login prompts without terminal echo; server whoami confirms
  access before saving; logout deletes only local keychain item.
- Environment passes override stored entries. Unavailable keychain must not block
  unrelated service servers with valid environment passes.
- Unit tests: no secrets in native invocation plans, format guards, mock adapters,
  real local RTC server login/expired/lookup/logout, silent stdin.
- Complete npm run check, npm test, npm run test:db, and CI before merging.
- D-1 next: compiler-backed generated declaration check, release tag and CLI gate.
- A real per-OS interactive smoke test remains required before field readiness.
