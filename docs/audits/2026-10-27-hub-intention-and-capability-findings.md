# Hub findings — intention, drift, and two capability gaps (2026-10-27)

**Author:** Vivienne (the owner's Muse assistant), at the owner's direction, after reviewing
this repository against `main` @ `5742713` and against the owner's stated intention.
**Status:** findings and fix directions for the next agent who works here. This document
implements nothing. The owner reviews wording on the PR that carries it.

## 1. The intention — what this hub is FOR

Robinson's Toolkit (the hub) exists to give the owner **one front door** to all of his service
servers (GitHub, Stripe, Workspace, Vercel, Neon, Dokploy, …): every server fully usable on its
own, the hub optionally combining them behind one connection, one pass system, one tool shape,
so any AI agent gets the same behavior from every server. The owner is not a developer; the
point of the fleet is **power with no friction for the owner and his agents** — ridiculously
capable tools where the user's credential is the authority and the tool never acts as a second
gatekeeper. Read `docs/END-USER-AUTHORITY.md` and the owner's 2026-10-27 decision (section 4
below) as the governing intent whenever a contract clause and this intention disagree.

## 2. The drift — how the work lost the intention

The owner observed, and this review confirms, that implementation effort drifted from shipping
a working front door to producing certifiable process artifacts:

- The architecture and status documents are stacks of dated checkpoints and caveats; the same
  "temporary relay is now disabled" paragraph is pasted into at least eight documents.
  Sediment is not progress.
- As of the October 17 checkpoints, the hub's own status concedes the normal flow — the hub
  discovering, authorizing and connecting a real service — **has never been certified with a
  real upstream**, while conformance machinery, relay transport and identity contracts grew to
  hundreds of files. A checkpoint is not a connection.
- The pattern to break: when choosing the next unit of work, prefer the smallest change that
  makes a real agent, through the real hub, do a real thing on a real server — over any
  document, probe or contract refinement that merely describes that ability.

## 3. Finding A — the hub does not (and cannot) solve the beyond-API gap

The owner asked whether the finished hub gives his agents more than the official APIs provide —
specifically **real git**: true push/commit mechanics, merge-conflict resolution, pushes that
trigger CI like a human's, history operations. Reviewed against `docs/CONTRACT.md`,
`docs/ARCHITECTURE.md` and `docs/MASTER-ROADMAP.md`:

- **It does not.** Nothing in the contract, the architecture or the roadmap gives the hub or
  any member server git-protocol capability. The hub routes member tool calls; a federation
  layer inherits its members' limits and cannot manufacture a capability no member has.
- The hub's genuine beyond-API value is **composition**: hub workflows that plan and execute
  multi-server jobs with one combined preview and undo, and developer runs that seed and clean
  up a whole environment across servers under one run ID. Build on that; do not oversell it as
  capability expansion inside a service.
- **Where the git fix belongs:** in the GitHub server itself (or a git-worker service it can
  call — e.g. hosted on the owner's Dokploy). Precedent exists in the fleet: the GitHub server
  already embeds a JavaScript git client for wiki repositories (owner decision IN-17 there).
  Do NOT attempt to grow git mechanics in this repo.

## 4. Finding B — RTC 1 bakes in defaults the owner has overruled

The Robinson Tool Contract is the highest-leverage document in the fleet: conformance forces
every member server to match it. As written, RTC 1 §6–§7 mandate, for every server, the exact
behaviors the owner overruled on 2026-10-27 for the GitHub server:

- §6 makes preview + `confirm: true` the required write ceremony (destructive, money,
  production, permission-widening writes must refuse without it).
- §7 fixes the 8 KB result ceiling with handle recovery, and list pages of 20 by default.
- §2 sets pass defaults `allow_writes = false` and money limit **$0** — the developer-budget
  default that already caused one fleet incident when it leaked from builder scope into
  product behavior on the GitHub server.

**The owner's governing principle (2026-10-27, applies fleet-wide):** an MCP server is a tool —
the owner's hands for his agent — never a service provider or a second authority. It never
enforces a limitation that belongs to the end user or to the platform: if the platform permits
the account and the user instructed it, the server discloses cost/effect, executes, journals
and verifies. The owner's standing rules (release policies, protected lists, caps) are
accident-prevention **defaults** for when he is not directing; his explicit instruction in the
moment outranks them. Rules have three scopes — builder rules (bind the implementing agents;
they live in agent-facing documents, **never in runtime code**), the owner's standing defaults
(overridable by him), and product behavior (almost nothing beyond secret hygiene, tenant
isolation and the journal). Authority hierarchy: owner's live instruction > owner's standing
rules > tool defaults.

**Fix, in order — this is the next contract work, ahead of new member servers:**

1. Draft RTC 2 (or a dated RTC 1 amendment) restating §6: confirmation is a *caller-supplied*
   argument honored in a single call; servers must not manufacture confirmation requirements
   from their own classifications. Journal, read-back and replay protection stay mandatory —
   they are the bookkeeping that makes full power safe.
2. Restate §7: results are caller-sized (`fields`/`detail`/explicit size) up to a generous
   inline ceiling; summary pages remain the *default for unsized lists*, never a wall in front
   of an explicit request; handles must actually work wherever a cut can occur.
3. Restate §2: pass defaults are the *issuing owner's* delegation choices; no fleet-wide $0
   money default and no writes-off default may be presented as a product protection. Developer
   sandbox limits bind builders only and must be labelled as such wherever they appear.
4. Add the scope rule to the contract's preamble: every requirement states who it binds
   (builders, the owner's defaults, or product behavior) and why; unscoped requirements are
   removed, not preserved.
5. Only then: certify the normal flow end-to-end with one real member server (the GitHub
   server) through the real hub — one agent, one connection, one real read and one real write
   with read-back — and record that, not another checkpoint, as the hub's first milestone.

## 5. What not to do

- Do not re-litigate the owner's principle in session chat and then "preserve the rule while
  fixing around it" — the failure mode this document exists to prevent. If a contract clause
  and the principle conflict, the clause is the bug; open the amendment.
- Do not add new member servers to RTC 1 as written; they would be born with the overruled
  defaults and multiply the cleanup.
- Do not count documents, probes or checkpoints as hub progress in status reports to the
  owner. Report connections that work.
