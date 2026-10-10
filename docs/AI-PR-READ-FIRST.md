# Read before any PR that touches passes, secrets, doors, the relay, federation or workflows

Write one line per applicable item in the PR saying how it is honored.

1. No pass, service key, GitHub token, relay private key or passphrase in code, tests, fixtures, logs, PR text or results.
2. Passes are shown once; the hub's stored server passes are encrypted; nothing logs a pass.
3. The relay puts only ciphertext on GitHub, deletes comments after reading, refuses replays, and holds nothing at rest.
4. No door skips a server's guards; the hub passes `dryRun`/`confirm` through and never widens a server pass.
5. No server is made to depend on the hub.
6. Local tools act only inside allowed folders; shell commands outside the read-only allow-list need `confirm`.
7. Cross-server workflows preview every step first and never undo automatically.
8. Contract changes are a new RTC version with a DECISIONS entry; conformance stays green.
9. A token refresh copies every connection setting from the issuing row; rate limits and lockouts are counted in the
   database (shared across serverless instances), never in memory — in the hub, the relay and every server (contract §2).
10. Results stay small (contract §7); the CLI's `--out` keeps big results out of an agent's context.
