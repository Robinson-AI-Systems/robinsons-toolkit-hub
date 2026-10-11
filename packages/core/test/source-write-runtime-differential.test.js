// Original Stripe write lifecycle, executed beside the portable version.
// No provider access; all operations mutate only a local spy ledger.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gitBlobSha } from '../../../scripts/check-original-assertion-bodies.mjs';
import { defineWrite as originalWrite } from '../../../docs/audits/upstream/runtime/write.js';
import { defineWrite as portableWrite } from '../src/write.js';

function fixture(defineWrite, { mode = 'test', profile = 'full', account = 'acct_fixture',
  targetAllowed = true, liveAllowed = false, failIntent = false,
  failApply = false, after = 'new', moneyPreview = null, approve = true } = {}) {
  const calls = { read: 0, apply: 0, readAfter: 0, verify: 0, inverse: 0,
    preflight: 0, finalization: 0, logs: [] };
  const options = {
    name: 'stripe_fixture_change',
    read: async () => { calls.read++; return { status: 'old' }; },
    summarize: async () => 'Update a synthetic record in TEST mode.',
    apply: async () => { calls.apply++; if (failApply) throw Error('synthetic transport failure'); },
    readAfter: async () => { calls.readAfter++; return { status: after }; },
    verify: async (_before, observed) => { calls.verify++; return observed.status === 'new'; },
    inverse: async () => { calls.inverse++; return { tool: 'synthetic_restore', args: { id: 'fake' } }; },
    idempotency: () => 'rmcp_synthetic_repeatable',
    targetGuard: async () => targetAllowed,
    modeGuard: async () => liveAllowed,
    prepare: moneyPreview ? async () => moneyPreview : null,
    beforeApply: moneyPreview ? async () => { calls.preflight++; return { accepted: approve }; } : null,
    afterApply: moneyPreview ? async () => { calls.finalization++; } : null
  };
  const op = defineWrite === portableWrite
    ? defineWrite({ ...options, accountOf: c => c?.stripeAccount, idempotencyPrefix: 'rmcp_' })
    : defineWrite(options);
  const context = {
    connection: { stripeAccount: account, mode, profile },
    connectionId: 'isolated-connection',
    db: { recordChange: vi.fn(async entry => {
      if (failIntent && entry.summary?.startsWith('PENDING:')) throw Error('synthetic database outage');
      calls.logs.push(entry);
    }) }
  };
  return { op, context, calls };
}
async function execute(implementation, scenario, args) {
  const f = fixture(implementation, scenario);
  const envelope = await f.op.handler(args, f.context);
  return { envelope, content: JSON.parse(envelope.content[0].text), calls: f.calls };
}
const behavior = output => ({
  done: output.content.done,
  confirmed: output.content.confirmed,
  needsConfirmation: output.content.needsConfirmation,
  preview: output.content.preview,
  isError: output.envelope.isError || false,
  reads: output.calls.read,
  writes: output.calls.apply,
  readBacks: output.calls.readAfter,
  verifications: output.calls.verify,
  inverses: output.calls.inverse,
  preflights: output.calls.preflight,
  finalized: output.calls.finalization,
  audit: output.calls.logs.map(l => ({
    account: l.account, mode: l.mode, connection: l.connection, tool: l.tool,
    dryRun: l.dryRun, key: l.idempotencyKey, direction: l.direction,
    amountCents: l.amountCents, summary: l.summary
  }))
});

describe('K-3 original guarded write runtime compatibility', () => {
  it('pins and executes the unmodified original source Git blob', () => {
    const path = fileURLToPath(new URL('../../../docs/audits/upstream/runtime/write.js', import.meta.url));
    expect(gitBlobSha(readFileSync(path, 'utf8')))
      .toBe('82157d03a818a60d6a9ae6e28dd798e0e7ca2a86');
  });
  it.each([
    ['needs explicit confirmation', {}, {}],
    ['rejects fake confirmation', {}, { confirm: 'yes' }],
    ['dry run even when confirmed', {}, { dryRun: true, confirm: true }],
    ['confirmed write with read-back', {}, { confirm: true, requestKey: 'retry' }],
    ['rejects unowned target', { targetAllowed: false }, { confirm: true }],
    ['rejects disabled LIVE writes', { mode: 'live' }, { confirm: true }],
    ['rejects read-only connection', { profile: 'read_only' }, { confirm: true }],
    ['records uncertain outcome', { failApply: true }, { confirm: true }],
    ['records mismatched read-back', { after: 'stale' }, { confirm: true }],
    ['refuses when audit intent fails', { failIntent: true }, { confirm: true }]
  ])('%s: same side effects and audit transitions', async (_name, scenario, args) => {
    const original = await execute(originalWrite, scenario, args);
    const portable = await execute(portableWrite, scenario, args);
    expect(behavior(portable)).toEqual(behavior(original));
    if (original.content.done === true) {
      expect(portable.content.idempotencyKey).toBe(original.content.idempotencyKey);
      expect(portable.content.summary).toBe(original.content.summary);
    }
    if (original.content.done !== true) {
      expect(portable.calls.apply).toBe(original.calls.apply);
    }
  });
  it('retains independent money approval and source-compatible successful reservation lifecycle', async () => {
    const moneyPreview = { previewLine: 'Synthetic provider amount', amountCents: 75,
      currency: 'usd', direction: 'out' };
    const approved = { moneyPreview, approve: true };
    const original = await execute(originalWrite, approved, { confirm: true });
    const portable = await execute(portableWrite, approved, { confirm: true });
    expect(behavior(portable)).toEqual(behavior(original));
    expect(portable.calls.preflight).toBe(1);
    expect(portable.calls.finalization).toBe(1);
    expect(portable.calls.apply).toBe(1);
    const denied = await execute(portableWrite, { moneyPreview, approve: false }, { confirm: true });
    expect(denied.envelope.isError).toBe(true);
    expect(denied.calls.preflight).toBe(1);
    expect(denied.calls.apply).toBe(0);
    expect(denied.calls.logs).toHaveLength(0);
  });
  it('documents a deliberate stricter money-preview boundary rather than claiming exact parity', async () => {
    const malformed = { previewLine: 'Unknown provider amount', amountCents: -1,
      currency: 'usd', direction: 'out' };
    const portable = await execute(portableWrite, { moneyPreview: malformed }, { confirm: true });
    expect(portable.envelope.isError).toBe(true);
    expect(portable.content.error).toMatch(/Invalid provider-derived money preview/);
    expect(portable.calls.apply).toBe(0);
    expect(portable.calls.preflight).toBe(0);
    expect(portable.calls.logs).toHaveLength(0);
  });
});
