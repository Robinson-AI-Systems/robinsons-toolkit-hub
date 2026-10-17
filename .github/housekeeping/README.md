# Current owner-authorized Git closeout — October 17, 2026 UTC

The owner requested documentation reconciliation, all necessary merges and Git cleanup in both repositories, followed by a Workspace release. The current exact-repository plan replaces the expired October13 inventory with newly inspected branch heads. It keeps main/live, existing archives and every immutable release marker. Every deletion remains protected by archive ancestry, exact remote SHA leases and a fresh open-PR head/base check. The source branch of this maintenance PR can retire itself only after its exact tip is merged. Cleanup refuses after October19,2026 UTC; the original October13 context retains its original expired deadline. No production source or credential changes occur during cleanup. The owner-requested Workspace release is a separate checked operation after cleanup.

In the companion Workspace repository, one branch containing old TEST-withdrawal work is superseded: its helper and withdrawal tests exactly match main, and both request-time enrollment guards plus reused authorization row are present in current db.js. Its obsolete plaintext-storage tree must not be merged. The archive preserves its complete history before deletion. All other listed source tips are ancestors of the reviewed main snapshot. Concurrently advanced or open-PR branches remain protected. A successful Action and remote readback are required before claiming cleanup complete.

## Historical October13 maintenance

# Owner-authorized Git housekeeping — October 13, 2026

The owner requested full reconciliation of abandoned, duplicated and superseded Git work. plan.json pins exact source tips and PR dispositions. Preserve all listed source history under the non-production archive before deleting any unchanged branch; protect active PR heads/bases, advanced tips, main, live and existing archives. **Never merge the archive into main**: its current-main file tree and historical parents preserve recovery history without introducing obsolete code.

The write job runs only on main push after checked merge and expires October 15 UTC. Tests cover protected refs, active/advanced heads, archive ancestry with a different historical file tree and stale deletion leases against real local Git. Actual Action success and independent remote ref readback are required before claiming deletions. No release, provider mutation, credential retrieval or spending is performed. Existing application/CI/provider acceptance gates remain mandatory.
