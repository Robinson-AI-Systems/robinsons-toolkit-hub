# Proposed Google Workspace MCP adoption — **not executed**

Status: **handoff only; WAITING FOR COMPLETE K-3 RELEASE AND WORKSPACE-OWNED CARD**. This file neither changes Workspace nor certifies its protocol, APIs or SQL. Its authoritative integration card is P8-6 in the Workspace project's own plan (verify actual current state at adoption time).

## Process after a verified K-3 GitHub Release

1. Use Workspace's own instructions, card process, auth/security rules, CI and current source code. Confirm RTC version advertised by Workspace, test environment and standalone viability before importing core. Never make Workspace depend on Robinson's Toolkit Hub for runtime operation.
2. Pin the exact immutable `robinson-mcp-core-<semver>.tgz` GitHub Release asset and verify its SHA256 (a local `npm pack` hash is not a released artifact). Start with pure crypto/OAuth/HTTP/registry helpers, comparing actual Workspace behavior against real source tests before replacing it.
3. Model Workspace's own account identity, token storage, permission domains, delegated user boundaries, revocation, service API clients and login UI as **required server adapters**. Do not reuse Stripe's `stripe_account`, AAD values, setup URLs, pass assumptions, mode profiles or retry prefixes as defaults. No shared-core helper gets owner authority merely because it exposes a hook.
4. Implement store methods for one-time secrets, OAuth grants/rotation, logged attempts and scoped results against Workspace's actual durable storage. Verify encryption context, atomic one-time consumption, shared SQL lockouts, refresh preserving all connection settings, and proper tenant/user result visibility across instances.
5. For writes, retain Workspace owner authority, target/tenant scoping, dry-run/confirm previews, audit intent before mutation, verified read-back, rejected versus uncertain error handling, and service-specific live/production gates. Never treat `confirm:true` as independent owner approval for financial outflows; do not import Stripe policy.
6. Adapt MCP dispatch with server-owned per-tool authorization, secret redaction, result persistence and transport. Test guessed-name, nested-call, denied-tool, partial/error, replay, large output and expiry/refusal paths without real credentials.
7. Run Workspace unit, mock, data-store and relevant conformance suites on the pinned package, including before/after negative-path behavior. Create the migration/reversion PR **within Workspace's repository**, require exact-head CI and reviews, and keep service-independent direct doors. On mismatch, retain local implementation and record an explicit discrepancy rather than weakening security or claiming complete adoption.

## Owner and release gates

This proposed handoff does not activate production, buy anything, create cloud resources, or supply OAuth client secrets. The hub's K-3 card remains IN_PROGRESS until full source parity, actual Release asset and adoption handoffs are verified. Neither project may assume local artifact smoke proves real service integration.
