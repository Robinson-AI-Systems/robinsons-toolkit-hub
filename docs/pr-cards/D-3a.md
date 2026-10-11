# D-3a — Authenticated encrypted GitHub relay client

Status: MERGED (#17), written as if merged for CI.
Approved Batch D §1 D3/D4 and §4 D-3, split amendment 2026-10-11.
Prerequisites D-1 and D-2 merged; baseline main 10145fdd71ac737b1bbf98f333e5797b060351cc.
Risk area credentials and ciphertext secrecy; below 450 production LOC
because webhook processing and replay locks are a separate trust boundary.

## Read only these

- RTC CONTRACT §§2,6–9; BATCH-D D3/D4 and acceptance table.
- AI-PR-READ-FIRST, SESSION-START, AGENTS and existing CLI config/HTTP.
- Crypto and GitHub fake tests, no live pass or private service account.

## Drift check A

| Assumption | Actual | Kind | Resolution |
|---|---|---|---|
| rtool CLI and local MCP work | #12–16 merged | Match | Reuse safe call contracts |
| relay repo/keys already available | Owner input IN-03/IN-04 outstanding | External gate | Fake transport tests only |
| GitHub comments may contain passes | Prohibited by design | Security | X25519 sealed request |
| Relay can persist reply keys | Prohibited by design | Security | Client retains in memory |

## Build/acceptance

- Per-request ephemeral X25519 key and AES-256-GCM envelope, with random reply
  key inside the authenticated ciphertext; authenticated response bound to ID.
- Validate timestamp, 5-minute window, schema and pass format, payload size,
  and reject tampering, wrong key or reply ID.
- GitHub issue comments contain only ciphertext envelopes/public key material;
  no pass, tool arguments or reply key. Fixed GitHub API domain; no arbitrary URL.
- Poll for matching encrypted reply; delete both comments, including cleanup on
  timeout; expose cleanup failure explicitly. No secret-bearing logs or argv.
- Unit tests exercise actual crypto and fake GitHub comment service, tamper
  rejection, reply, cleanup, untrusted repo validation and pass absence.
- Successor D-3: signed GitHub webhook, PostgreSQL replay protection, server
  relay forwarding and CLI fallback. No fake production connectivity claims.
