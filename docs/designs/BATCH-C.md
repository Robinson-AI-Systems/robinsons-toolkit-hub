# Design — Batch C: Cross-server workflows ("super tools")

Status: **APPROVED** (Chris, 2026-10-10). Scope: `docs/PLAN.md` → Batch C. Cards C-1 … C-3. Depends on Batch H.

The old toolkit's most valuable idea: one call that spans services (provision a tenant: Stripe customer + database +
login + welcome email; close out a YardSync job: database + email + invoice). In the new architecture these live in the
hub and call servers through their contract doors, so every step keeps that server's safety rules.

## 1. Decisions

**C1. Plan first, one confirmation.** A workflow first runs every step with `dryRun: true` on its server and shows one
combined preview (each server's own preview line). With `confirm: true` it runs the steps in order.

**C2. Ledger and compensation.** Each executed step's server change-log id and inverse (when the server reports one) is
recorded in `hub_workflow_runs`. If a later step fails, the workflow stops, reports exactly what was done, and offers
`hub_undo_run(run_id)`, which calls each server's undo tool in reverse order where an inverse exists and lists what cannot
be undone (money movement, sent email). Nothing is undone automatically.

**C3. Development environments first.** The flagship workflows are for building:
`hub_dev_environment_up(project, runId?)` — one preview, one confirm — creates a scratch GitHub branch or repo, a Neon
branch, a Vercel preview with environment variables wired to it, Stripe test data and a forwarder pointing at the preview,
and Workspace fixtures, all under one `runId` (contract §10); `hub_dev_environment_down(runId)` calls each server's
`<prefix>_dev_cleanup` for that run and reports per server. Each step only runs on servers that exist; missing ones are listed,
not faked.

**C4. Port only what is used.** The old toolkit's compound tools are a list of ideas; each is ported only when its servers
exist and Chris wants it (candidates: provision a project, full feature deploy, staging refresh, tenant provisioning,
weekly engineering report, cost audit).

## 2. Schema

```sql
CREATE TABLE IF NOT EXISTS hub_workflow_runs (id TEXT PRIMARY KEY, workflow TEXT NOT NULL, connection TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), status TEXT NOT NULL, steps JSONB NOT NULL);
```

## 4. Work units
### C-1 — Workflow engine: plan, confirm, run, ledger, undo-run (L, medium effort)
Tests with fake servers: combined preview changes nothing; failure mid-run stops and reports; undo-run reverses in order
and lists what it cannot reverse.
### C-2 — Development environment up/down across servers (L, medium effort)
Tests with fake servers implementing §10: one runId across servers; partial failure stops and reports; down cleans only
that run on each server.
### C-2b — Ported workflows (M each, written JIT per workflow)
### C-3 — Weekly digest across servers (M)

## Amendments
