# Decisions (dated)

**2026-10-10 — One standalone server per toolset; Robinson's Toolkit becomes the front door.** After a reality check
showed the old toolkit's 3,049 tools are cheap on context (search-then-call already) but unverifiable (its test script
only checks that keys exist; `TEST_RESULTS.md` claims all functional), Chris chose to build each toolset as its own
solid, hosted server — Google Workspace MCP and Stripe MCP first — and make Robinson's Toolkit the single MCP, CLI and
HTTPS front door combining them. Audit: `docs/audits/2026-10-10-old-toolkit.md`.

**2026-10-10 — Build Chris's own servers even where official connectors exist (Chris).** Official connectors for
Vercel, Neon and others give less functionality, and different agents get different permissions with them. Robinson
servers give every agent the same full tool set with Chris's safety rules.

**2026-10-10 — Servers stay fully usable on their own; build them as needed (Chris).** The hub is a long-term project.
So this repo delivers the direct doors first (`rtool`, local MCP, GitHub relay), which work with any single server
without the hub, and no server ever depends on the hub.

**2026-10-10 — The Robinson Tool Contract (RTC 1).** A written contract (`docs/CONTRACT.md`) every server follows, with a
conformance test, so the hub stays a thin router and every agent sees identical behavior from every server.

**2026-10-10 — Shared code is extracted, not designed up front.** The Stripe MCP writes its contract code in `src/core/`;
this repo extracts it into `robinson-mcp-core` once proven (K-3), and other servers adopt it.

**2026-10-10 — Relay encrypts to the relay's own key.** The GitHub relay seals requests (including the pass) to the
relay's public key, so GitHub sees only ciphertext and servers never need to know about the relay.

**2026-10-10 — Public repository, no automated review**, as for the Stripe MCP.

**2026-10-10 — A general development tool (Chris).** "This should be general, able to work freely on any project … It
is supposed to be a powerful development tool." Real projects are completeness checks only. Added contract §10
(developer conventions: safe modes, runs tagged `rtc_run`, cleanup by run, scenarios, integration checks), a Developer
tools batch (V) to the server playbook, generic purposes in the server roadmap, and development-environment up/down as
the hub's flagship cross-server workflows. Stripe gained its Batch V; Workspace gained P8-7.

**2026-10-10 — Owners and end users too, not only developers (Chris).** "These toolsets should be great for both
developers and end users of each service, account management tools … everything." Contract §3 adds an `audience` tag
(builder / owner / operator); new §11 requires every server to cover the owner side: an admin overview, real tools for
every owner setting with an API, guided settings with structured steps and read-back for everything without one, and a
full dashboard map. The playbook adds research steps 9–10 (owner side, coverage matrix) and a standard batch O; the hub
adds L-4, a guided settings runner that walks dashboard-only settings in a visible browser with Chris approving each step
(never typing passwords). The old toolkit's audits had found account, team, billing and security tools "broadly absent".

**2026-10-10 — Two rules from the Workspace server's review (RTC 1 clarification).** An automated review of the Google
Workspace MCP plan (its PR #28) found that (1) an OAuth refresh could drop a connection's settings (a read-only
connection becoming full access) and (2) an in-memory rate limit does nothing on serverless hosts. Contract §2 now
requires both (settings copied on refresh; limits counted in the database), conformance checks both, and the hub, relay
and Stripe plans follow. RTC 1 is not final until K-1, so this is a clarification of version 1, not a new version.

**2026-10-10 — Tool names always start with the server prefix; Node 24.x (RTC 1 clarification).** Planning GitHub,
Vercel and Neon together showed shared nouns (project, branch, member, workflow, webhook, admin) across servers that are
loaded into one chat; some clients don't namespace tools by server. Contract §3 now requires `<prefix>_…` on every tool
name. Vercel stopped deploying Node 20 on 2026-10-01, so every server and the hub use Node 24.x. Still a draft
clarification of RTC 1 (before K-1). Stripe and Workspace adopt through their own cards (STATUS).

**2026-10-10 — K-0: the hub gets a code foundation card before K-2.** The plan went straight from docs (K-1) to the
conformance package (K-2) with no card creating the repository's checks and CI; every server has A-1 for that. K-0
copies the newest proven foundation (`neon-mcp`) and adds hub-specific secret rules. Scripts that would only pretend
(`test:conformance`, `test:doors`) are left to the cards that first have real tests. K-2 is split (K-2b) to keep PRs
under the 500-line budget. A contract change now always needs a DECISIONS entry in the same PR (enforced by the docs
check).

**2026-10-10 — No compatibility with the old toolkits; Batch M dropped (Chris).** "The reference to the older toolkits
was to help make sure you designed this custom MCP with as much functionality as possible … I don't need legacy
compatibility." Batch M (freeze, smoke test, namespace map, `--legacy` bridge, retirement checklist) is dropped and its
design moved to `docs/archive/`; IN-05 answered "not needed". The old toolkits stay what they were meant to be: a
checklist each server's gap check covers. Servers drop their old-name maps and toolkit decision notes the same way.

**2026-10-10 — Stronger anti-stall rules (from the implementing agent's own diagnosis).** Sol stopped after opening a PR
with red CI although nothing blocked it. Its reasons: too much code before running tests; preventable CI errors (a wrong
API parameter, lint, outdated test expectations); no rule forcing a red PR to be finished first; and chat sessions that
end between actions. Added: SESSION-START §0 (finish open PRs first), §6 (problems vs real blockers, thin slices, a
no-shell path with draft PRs, an exact recovery point at every push) and AGENTS rules 11–13.

**2026-10-11 — K-1 freezes RTC 1 and makes conformance evidence explicit.** Reviewed Stripe Batch R, Workspace
Phase 8 and the GitHub/Vercel/Neon Batch R plans; all five plan the same RTC 1 doors and guarded
passes, while their rate defaults (Neon 60/minute; others 120/minute) deliberately differ per service.
The source trees of all five showed no `/api/contract` implementation when checked for the freeze.
Pass values use `rtc_pass_` plus 43 unpadded base64url characters from 32 random bytes, which secret scanners
catch by shape. Conformance role passes are passed only through named environment variables; missing
roles show `skipped`, never passed. The rule-to-test table names service-specific checks where a wire-level
probe cannot prove one-time issuance, database behavior or owner dashboard coverage. A later contract
change requires RTC 2 (or newer), not an in-place clarification.

**2026-10-10 — CI cadence (from the implementing agent's review of its own CI use).** Every push runs the full CI on
purpose (the merge gate must be green at the exact head). The waste was pushing fixes while a run was still going, which
started overlapping full runs. Rule added to SESSION-START §6: never push while your PR's run is in progress; collect all
failures, fix them together, push once; run checks locally first; "re-run failed jobs" only for infrastructure hiccups.
CI cancels an obsolete PR run when a newer push arrives.
