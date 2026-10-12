# Implementation guide — code-grounded recipes

Read only the route for your current card. AGENTS, CONTRACT, approved designs and
owner inputs govern; this guide supplies navigation and execution detail, not new
scope or approval. **Existing** means present at the inspected commit. **Proposed**
means a suggested JIT card path/interface, not delivered code or an approved change
to a semantic boundary. Recheck the current main and any dependent server first.

## 1. Snapshot and reading routes

Inspected 2026-10-11: hub `a468d0cebda41774d798a094beb15ccf8687bd77`
(PR #20 merged; no open hub PRs), Stripe
`2a71f8a03845ad3bf8c8de9de4207a72596ace78` (read-only source inspection;
A-1–A-6, B-1–B-8 and C-1–C-2 marked MERGED in its work index). No open
Stripe PR was returned at inspection. These are snapshots, not future readiness.
No source, tests or state in the Stripe repository are changed by this guidance.

| Current work | Read this section, then only cited source/tests |
|---|---|
| Write a JIT card | §2 packet; current design heading; drift checklist A |
| CLI/SDK/MCP or future RTC door | §3 wire map and §4 fake recipe |
| SQL/shared counters/replay | §5 database recipe |
| Next K-3 extraction | §6 worked example and source boundary inventory |
| K-4, H, C, L | §7 remaining-work routes; write exact contracts JIT |
| Owner-gated real D-4 proof | D-4 card; AGENT-SETUP; OWNER-INPUTS IN-02/03/04 |

Repeated discovery to eliminate: finding the real dispatcher instead of inventing
another HTTP client; locating result pagination and private file behavior; building
fake credential/guard fixtures again; confusing an in-memory replay test with SQL
proof; assuming a `core/` folder is portable; planning exact APIs for distant cards
before their prerequisites exist. Keep the corresponding facts in each card packet.

## 2. The executable card packet

Extend the existing 40–100-line card, normally with compact tables. Do not create
distant cards or mark proposed files READY/MERGED. Budget remains AGENTS' ~500
production-line target / ~800 hard maximum (README's ≤500 is a planning budget).

1. Baseline: hub SHA, source server SHA if any, predecessor PR/dispositions,
   changed-path comparison and required owner gates. An absent deployment is not
   proof that a real server conforms.
2. Files: label every entry Existing/Proposed; name exports, callers, owning tests
   and dependency injection. Include a narrow ripple search for changed exports.
3. Mapping: input → normalization → RTC path or parameterized DB method → output;
   guard before side effects; independent read-back afterward. For pure helpers,
   explicitly write “no API/DB side effects.”
4. Ordered slices: ≤~150 production lines per targeted test/lint run. Each slice
   names fixtures, observable expectations and which successor gets the export.
5. Failures: refusal, missing config, invalid input, denied scope, partial/uncertain
   outcomes; name the forbidden mutation or leak for each. Fake success alone is
   insufficient: assert a counter, state, SQL row or captured request too.
6. Validation: copy exact existing test filenames and required full gates. Proposed
   test commands become runnable only after the named file is created. Acceptance
   evidence: command + result + head, with honest unrun/skipped/owner-pending items.
7. Handoff: exported signatures, schema/migration owner, result/error shapes,
   release pins, carried findings. Reconcile once when a parallel PR lands; do not
   edit another in-flight card/status/index entry from a planning PR.

PRs still need drift A, checklist B, self-review, all threads handled and exact-head
`ci`. This packet does not bypass any of those steps or replace approved designs.

## 3. Existing RTC integration map

These are actual client mappings; CONTRACT §§1–7 remains the server authority.

| Input / action | Existing implementation and wire mapping | Verification / invariant |
|---|---|---|
| Config alias and pass | cli/src/config.js `loadServers`, `passFor`; cli/src/dispatch.js `byName`, `requirePass` | Missing pass affects that server; no secret in persisted config |
| Unqualified prefixed tool | dispatch.js `selectServer(servers, env, requested)` probes manifests; qualified `alias.tool` selects alias | Zero/ambiguous prefix owners refuse; never guess a server |
| Manifest / identity | http.js `contract(base, pass, fallback)` → GET /api/contract; dispatch.js `send(server, '/api/whoami')` | `rtc === 1`, valid prefix; use actual identity/profile |
| Search | commands.js `runCLI(argv, options)` → GET /api/tools?q=…&area=…&limit=…; pages.js `toolPages(server, initial)` | Object metadata from pages; limit 1–100; repeated/unsafe cursor refused |
| Describe / call | GET /api/tools/NAME; POST same path with JSON args | `--dry-run` → args.dryRun, `--confirm` → args.confirm; server owns guards |
| Projection / detail | commands.js maps --fields to array and --detail to summary/full | Fake accepts array; actual server inputSchema governs other doors; don't universalize fake shape |
| Batch | POST /api/tools/_batch with `{calls:[{name,args}]}` | At most 10, server determines eligibility; fake permits reads only |
| Large result | pages.js `materialize(server, data)` → GET /api/results/HANDLE and subsequent pages | Same pass/origin; 50 pages / 50 MiB cap; error rather than silent clipping |
| Private output | commands.js output → exclusive `wx`, mode 0600 | New file only, no overwrite; 9000-character fake payload preserved, short terminal summary |
| Direct HTTP / fallback | http.js `httpRequest(base, pass, path, {method,args,fallback})`; relay-route.js `safeToFallback` | Authorization header, redirect refused, 12s timeout; ambiguous POST never auto-repeated |
| Relay allowed HTTP | relay/src/routes.js `relayHttpRoute(args)` normalizes method/path/body | Exact RTC allowlist, query allowlist, no arbitrary URL or scope widening |

All `cli/` paths above are under `packages/cli`; `relay/` under `packages/relay`.
For changes to doors inspect SDK generation in cli/src/sdk.js and local MCP in
cli/src/mcp.js too. Their independent door tests already exercise actual HTTP,
not a fabricated dispatcher result. Use commands.test.js, sdk-setup.test.js,
typescript.test.js, mcp.test.js and relay-routing.test.js as the corresponding bases.
Do not import CLI routing/keychain state into future hosted hub authorization.

## 4. Reusable real-HTTP fake recipe

Existing: `packages/conformance/fake-server/server.js`
`startFakeServer({prefix='fake', faults=[], passes, rateLimit})` returns a localhost
fixture with `url`, runtime-generated `passes`, `state`, `oauth` and `close()`.
Use a `try/finally` to close every fixture. Generate keys/passes in memory; never
paste real-looking literal credentials into tests, docs or assertion messages.

1. Start `prefix: 'alpha'` and `prefix: 'beta'` fixtures for two-server behavior.
   Inject `{RTOOL_SERVERS: 'one='+a.url+',two='+b.url,
   ['RTOOL_'+'PASS_ONE']: a.passes.full, ['RTOOL_'+'PASS_TWO']: b.passes.readOnly}` and captured
   out/err streams into `runCLI`; inject a fake vault where testing vault-independent
   behavior (existing commands tests show the minimum fixture).
2. Read `alpha_read_record`: initial `state.value === 'original'`, returned payload
   is short. `detail:'full'` gives 9000 characters and a scoped handle. Retrieve it
   with another pass: not_found; no leaked content. Close fixtures afterward.
3. `alpha_delete_record` without confirm → needsConfirmation and CLI exit 2;
   dryRun+confirm still leaves value original. Fake previews append preview log
   entries: “no mutation” refers to business state, not zero audit rows.
4. `beta_write_record` with the readOnly pass → refused_by_guard / exit 3; business
   state unchanged. Expired/revoked → CLI exit 5; unknown owner prefix → exit 6.
   Assert stdout/stderr do not contain fixture pass values without printing them.
5. A successful fake write is only a door/guard fixture, not evidence of any real
   service write or money approval. This fake's ordinary write need not confirm;
   do not copy that shortcut into a production write lifecycle.

Conformance: `runConformance({url, passes, oauth, instances})` from
`packages/conformance/src/run.js`. With full fixture roles, omitted `instances`
leaves two-instance proof skipped and top-level ok false: require every named
check to pass for complete certification. Existing negative.test.js maps deliberate faults to exact failed
checks: no-manifest→manifest; write-ignores-dry-run→writes;
read-only-pass-can-write→passes.read_only; key-in-result→safety;
oversize-without-handle→reads; unprefixed-tool→catalog;
bad-error-envelope→safety; refresh-drops-settings→oauth.refresh_settings.
Reuse fault injection for regressions rather than weakening the probe.

Focused commands (existing, executable):
```bash
npx vitest run packages/cli/test/commands.test.js packages/cli/test/relay-routing.test.js
npx vitest run packages/conformance/test/negative.test.js packages/conformance/test/skips.test.js
npx eslint packages/cli/src/commands.js packages/cli/src/http.js
```
Full check + unit suite still run before the push; do not add redundant full-suite
runs between unchanged slices. Door/conformance checks are added as PLAYBOOK 4b requires.

## 5. Reusable database and before/after proof

Existing `tests/db/isolated-schema.js`: `openIsolatedSchema()` →
`{url,schema,pool(),query(text,params),close()}`. It refuses nonlocal DB URLs through
local-url.js. Each `pool()` is independent with the same isolated search_path;
close pools and drop the schema in finally. Do not use a Neon/production URL.

Worked existing replay mapping: relay/src/store.js `createReplayStore(db)` accepts
`db.query`; claim(UUID) inserts `$1` into relay_seen.request_id using ON CONFLICT
DO NOTHING RETURNING request_id. `rowCount===1` is the sole successful claim;
prune deletes seen_at older than one day. Migration owner is D-3,
packages/relay/migrations/001-relay-seen.sql — never recreate it under a new number.

| Before / fixture | Operation | Required after / forbidden effect |
|---|---|---|
| No UUID row; two stores with independent pools | Concurrent claim of same generated UUID | Exactly one true, one false, one row; only winner forwards |
| Row already claimed | Repeat after reply-post failure | No second provider call; retained claim, uncertain outcome reported |
| Store throws / unavailable | Signed valid request | 503, no forward and no success reply |
| Invalid signature, binding, ciphertext | Relay server dispatch | Refusal before provider call; capture forward count |
| One fresh and one >1-day row | prune | Old row gone, fresh row survives |

Existing executable checks:
```bash
npx vitest run packages/relay/test/server.test.js packages/relay/test/routes.test.js
npm run test:db -- tests/db/relay-seen.test.js
npm run test:db -- tests/db/conformance-instances.test.js
```
No local Postgres → harness exits 2; record that honestly and require green CI db
proof. Future H/C schemas use the same harness. A single pool/in-memory Map cannot
prove shared limits, atomic grants or distributed lockouts.

## 6. Worked next unit: K-3 extraction boundary, then portable first slice

This is a worked planning recipe, **not an executable K-3 card**. STATUS selects
K-3; write its card JIT after fresh source verification and amendment disposition.
A–C completion is verified at the source snapshot, but BATCH-K K2's portable-core
assumption fails. “No Stripe SDK import” alone is too weak: semantic dependency and
transitive imports count. Do not mark K-3 or a core release complete on partial proof.

### 6.1 Existing source inventory (Stripe paths; nothing copied yet)

| Source / interface | Coupling and test owner | Extraction disposition to put in JIT card |
|---|---|---|
| src/core/registry.js `mergeNamespaces(modules)` → {tools,handlers} | Pure; registry.test.js also imports whole server catalog | Portable candidate; retain duplicate/missing-handler assertions separately from server catalog |
| src/core/oauth.js randomToken, hashToken, secretsMatch, verifyPkce, validRedirectUri, clientIp, evaluateLogin | Node crypto/net; evaluateLogin injects store; oauth-core.test.js imports test/helpers/fake-db.js | Portable candidate; copy test assertion bodies with explicit import rewiring/helper dependency inventory |
| src/core/crypto.js readEncryptionKey, encryptSecret, decryptSecret | AES-GCM, explicit aad/key; portable tests inside tests/unit/keys.test.js | Portable candidate; retain exact encryption assertions; provider key-store tests remain server-owned |
| src/core/http.js publicOrigin, send, escapeHtml, paramsOf, only | No service imports; Vercel-style response methods | Portable candidate; response adapter required in tests, not node:http response directly |
| src/core/write-contract-check.js validateWriteDeclarations(tools) | Metadata semantics, no SDK; inspect tests/unit/write-contract.test.js | Candidate only after comparing declarations with frozen RTC |
| src/core/profiles.js | compactNames stripe_* and guardedTestAreas service policy; profiles.test.js imports MCP dispatcher | Retain service policy locally; any injected generic boundary requires reviewed amendment |
| src/core/write.js defineWrite(options) → {tool,handler} | connection.stripeAccount, rmcp_ retry keys, Stripe wording; write-core.test.js | Preserve hooks/audit/uncertain outcomes; never silently rename account/key semantics |
| src/core/oauth-handlers.js createOAuthHandlers({db,env}) | listStripeAccounts, stripe_account form and DB mapping | Adapter boundary needed; preserve refresh settings and durable login attempts |
| src/core/mcp-server.js createMcpHandler / dispatchReadOnlyTool | ../tools/errors.js, util.js, result-rules.js; stripe_get_result identity | Transitive dependency blocks whole-folder copy; do not import server result/provider code into core |
| src/core/mcp-auth.js requireMcpToken | Inspect connection/account mapping, HTTP dependency, DB contract | Not presumed portable solely by path |
| src/core/one-time-secrets.js createOneTimeStore | stripe-once AAD, row.stripe_account, /api/stripe/setup | Adapter/design amendment needed; changing AAD can make existing ciphertext unreadable |

### 6.2 Exact mapping and verification example

Portable login primitive: evaluateLogin({ip,supplied,expected,store}) first requires
expected, then store.recordLoginAttempt(ip) → attempt identifier;
store.countRecentFailedLogins(ip,15) → count. Count >5 returns locked; wrong secret
returns wrong/attemptsLeft; correct secret calls markLoginAttemptSucceeded(attempt)
and returns ok. Missing configuration throws before storage. The source
`tests/unit/oauth-core.test.js` uses createFakeDb({clock}) at time 1000000, five wrong
attempts, then correct secret locked, then +16 minutes correct secret ok. Preserve
all assertions; a shared SQL lockout test is still needed for server adoption.

Crypto mapping: readEncryptionKey consumes TOKEN_ENCRYPTION_KEY (32-byte base64);
encryptSecret(value,{aad,key}) → v1.nonce.tag.ciphertext; decrypt with same context
returns value. No API/DB calls in these primitives. Retain keys.test.js's first two
cases unchanged in assertion behavior: missing/invalid key refuses; random nonces
differ; plaintext absent; different aad/key or tampered payload refuses.
Do not change ciphertext format, use test secrets from memory or non-credential
strings, and never fall back to plaintext.

### 6.3 Ordered implementation proposal, once boundaries are reconciled

1. Fetch latest Stripe main read-only, record SHA and paths changed since this
   snapshot; read its current instructions, index and core boundary tests. Inspect
   every relative import. Inventory test bodies + helper imports + SQL ownership.
   Review source predecessor findings; don't modify that repo from here.
2. Record failed K2 in drift A and propose a dated BATCH-K amendment for portable
   slices / explicit service adapters. Resolve semantic interfaces before coding
   them. If it changes RTC, use a new contract version and adoption cards; if it
   needs an owner decision, keep that boundary gated. Pure copies can proceed only
   when consistent with the approved amendment. No compatibility with old toolkits.
3. Proposed first slice: packages/core/package.json (name robinson-mcp-core, exact
   version, ESM, explicit file/export allowlist); src/oauth.js, crypto.js, registry.js
   and http.js. Paths are **proposed**; packages/core does not exist in the snapshot.
   Copy portable functions without changing signatures/error semantics. Update
   root lockfile via npm, not by hand. Do not publish a complete-core claim yet.
4. Proposed tests: packages/core/test/oauth.test.js, crypto.test.js,
   registry.test.js, http.test.js. Keep source assertion bodies; list any import or
   fixture rewiring explicitly. For oauth use an inventoried source fake-db helper
   or a minimal store implementing the three exact methods; neither proves SQL.
   Registry fixture: module with test_read + handler; duplicate name and missing
   handler must throw. HTTP fixture captures setHeader/status/send; invalid
   external HTTP origin, credentials/query/fragment, malformed body and wrong
   method refuse; valid HTTPS origin and object/form body map exactly as source.
5. Each copied group → targeted tests + lint, commit. Proposed focused commands
   after files exist: `npx vitest run packages/core/test/oauth.test.js
   packages/core/test/crypto.test.js`; `npx eslint packages/core/src/*.js`.
   Then `npm run check`, `npm test`, existing conformance/door regressions.
6. Proposed isolation test: import only core's public exports in a clean temp
   consumer; all relative imports resolve inside core; no stripe SDK, server
   modules, account-specific routes/catalog or installed sibling workspace needed.
   Test through a packed tarball too: `npm pack --workspace packages/core
   --dry-run --json` first, inspect files, then pack/install in the temp consumer.
   Imports must not require secrets or perform network calls on startup.
7. Subsequent K-3 slices inherit these proven primitives and the explicit deferred
   boundary list. Test generic adapters against source behavior before creating
   release workflow/artifact. Release only the complete approved export set, pinned
   version + SHA/checksum + clean-consumer evidence; actual release existence is
   required, not just a workflow YAML. Provide adoption card text here for Stripe
   and Workspace; execution/testing happens under each server's own rules.

Forbidden effects: touching Stripe main/branches, live passes, provider requests,
loss of independent money-out owner approval or shared limit accounting, mutable
in-memory lockout substituted for SQL, policy widening, secret-bearing tarballs,
“unchanged tests” claimed after dropped assertions, or partial release called K-3 done.

## 7. Remaining planned work — bounded JIT recipes

All paths in this table are **proposed** unless explicitly called existing. These
are dependency/evidence packets; do not implement them from this document alone.

| Unit / prerequisite | Integration and ordered slices to resolve in its JIT card | Concrete fixtures / proof / inherited output |
|---|---|---|
| K-4 after complete K-3 + K-2b | Existing CLI commands.js runCLI and setup.js private path writing patterns; proposed cli/src/scaffold.js; templates in existing docs/kit/templates are currently just README. Define template inventory/exports first, then new-server parser, exclusive destination, generated package + checks | Temp empty destination succeeds; existing/symlink destination refuses without overwrite; generated repo installs/checks in isolation. Empty registry conformance needs a specific probe strategy because existing catalog probe requires nonempty tools: reconcile in design, never silently skip. Successor gets pinned core + real scaffold, not invented checks |
| H-1 after K-3, D-1 and two conformant servers | Proposed packages/hub and api hub doors; core public exports/pinned release; first create db/connector/manifest, then RTC doors using fake dependencies | Hub itself must pass conformance with all role/refresh/shared-rate fixtures. No service keys/hub dependency in backends; no real setup before applicable owner gates |
| H-2 after H-1 | BATCH-H §2 hub_servers schema owns additive migration; setup-auth → verified manifest/version → encrypted pass → row; health read-back/status. Name DB/export signatures from actual H-1 helpers | Fake alpha/beta manifests; bad RTC/auth, malformed origin, unavailable backend, non-production pass registration refuse. DB pass_enc not plaintext; changed URL/context cannot decrypt reused ciphertext. Verify row and health agree; H-3 inherits registry resolver, not direct provider clients |
| H-3 after H-2 | Registry resolver → backend RTC search/describe/call/batch; existing §3 wire map and fake recipe are behavior references. Define bounded fan-out/partial-error contract in JIT card; dryRun/confirm preserved | Two distinct prefixes route exactly once; ambiguous/unknown names refuse; readOnly backend guard intact; backend failure identified without fabricated result; listings under design's 5000-token budget with five fakes. H-4 inherits explicit routing envelope |
| H-4 after H-3 | Trusted hub identity/profile intersects registered backend scope; choose server profile from trusted auth, never args. Define exact narrowed-pass mapping from released core | Allowed server succeeds; forbidden server/profile/tool refuses before dispatch counter changes; missing/expired/revoked backend pass fails closed; no widened scopes. Subsequent workflow entry uses this same resolver |
| H-5 after routed call shape exists | BATCH-H hub_change_log migration: connection/server/tool/summary/server_log_id/dry_run; define log failure handling before claiming routed success | Preview log distinct from mutation; provider refusal/uncertain outcome recorded honestly; no args/pass/result secrets in summary; recent changes scoped by authenticated connection; workflow ledger inherits log identifiers |
| C-1 after H | BATCH-C hub_workflow_runs: id/workflow/connection/status/steps; preview all → confirm → ordered execute → persist each server log/inverse. Define status transitions, retry and ownership rules JIT | Three fake steps: previews leave business state unchanged; step 2 failure prevents step 3; persisted ledger lists only actual outcomes; undo explicitly requested, reverse order, noninvertible step listed. Server independent approval still applies: confirm never grants money-out consent; no automatic compensation |
| C-2 after C-1 and actual §10 servers | Read actual metadata for each backend dev tool; one runId passed to every participating server, per-server cleanup. Pin schemas in card from metadata, never guess API names; C-2b only for owner-requested workflows | Missing server listed honestly, partial failure stops, cleanup only this run's records, another run's fixtures survive. No paid resources/production activation without required owner approval |
| C-3 after federation reads | Actual server read metadata → scoped bounded reads → digest with per-server failures; no pretend weekly schedule or provider data | Two fakes, one unavailable: surviving data + named failure, no writes, no secret output; scheduling interface/gates defined in card, not invented now |
| L-1 after D-2 | Existing cli/src/mcp.js + commands.js currently reject extra mcp args; proposed cli/src/local/ files; define --local parser, canonical allowed roots, path/command guards, timeout/cap before wiring tools | Temp allowed root; ../, symlink escape, disallowed cwd, shell outside read-only allowlist without confirm all refuse. Timeout kills process, output cap explicit; never hosted in hub/relay; no sudo |
| L-2 after local dispatcher | OLLAMA_BASE_URL only; define metadata and bounded client in card; no implicit cloud fallback | Fake localhost Ollama: valid reply/error/timeout/malformed data; no service pass in request, no hosted route; missing config disables tool |
| L-3 after local boundaries | Local headless browser, configured host allowlist, screenshots as private files. Define redirect/subresource policy and lifecycle before launch | Disallowed host/redirect refuses; screenshot returns path, not bytes; browser cleanup on error; no access outside local roots |
| L-4 after browser + actual §11 server steps | Separate visible guided browser; actual server structured steps/verifyWith, approval pause per step. Do not reuse headless-only assumption for owner interaction | Fake steps paused until approval; no password/2FA fields filled; verifyWith read-back reports failure honestly; cancellation stops remaining actions |

## 8. Completion and freshness checklist

At PR boundary, compare current paths against the packet's baseline, reconcile
changed exports/fixtures once, and update successor guidance or CHANGES-SINCE-DESIGN.
Evidence must distinguish local behavioral proof, SQL proof, exact-head CI, released
artifact and owner-run external proof. Never replace one with another. The merge
gate remains `ci` (check + unit + db) from .github/workflows/ci.yml; publishing this
guide adds no new required CI job and weakens none. Keep only affected sections
fresh; future agents do not need to read this whole guide.

## 8. Efficient bounded K-3 execution (K-3ar)

For new approved K-3 slices use [DEVELOPMENT-EFFICIENCY](DEVELOPMENT-EFFICIENCY.md) for exact current
helpers, five targeted fixtures and source/release compatibility acceptance. This augments §6; it does
not revise any card, source version, financial control or independent service adoption gate.
