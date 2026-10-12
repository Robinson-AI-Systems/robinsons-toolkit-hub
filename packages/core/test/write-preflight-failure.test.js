import { describe, it, expect, vi } from 'vitest';
import { defineWrite } from '../src/write.js';

function setup({ fault } = {}) {
  const effects = [];
  const fail = () => { throw new Error('private-error-' + 'SENSITIVE_SENTINEL'); };
  const hooks = {
    name: 'test_change', accountOf: c => c.account,
    idempotencyPrefix: 'fixture_',
    idempotency: vi.fn(() => 'fixture_stable'),
    read: vi.fn(async () => ({ balance: 100 })),
    targetGuard: vi.fn(async () => true),
    prepare: vi.fn(async () => ({ previewLine: 'Move fixture', amountCents: 1,
      currency: 'usd', direction: 'out' })),
    summarize: vi.fn(async () => 'Approve test fixture'),
    beforeApply: vi.fn(async () => ({ accepted: true })),
    apply: vi.fn(async () => { effects.push('write'); }),
    readAfter: vi.fn(async () => ({ balance: 99 })),
    verify: vi.fn(async () => true)
  };
  if (fault) hooks[fault] = vi.fn(fail);
  const db = { recordChange: vi.fn(async () => {}) };
  const ctx = { connection: { account: 'acct_test', profile: 'full',
    mode: 'test' }, connectionId: 'conn_test', db };
  return { op: defineWrite(hooks), hooks, ctx, db, effects };
}
const unwrap = result => JSON.parse(result.content[0].text);
describe('K-3 pre-provider exception sanitization and fail-closed approval boundary', () => {
  for (const hook of ['read','targetGuard','prepare','summarize','idempotency']) {
    it('sanitizes a throwing ' + hook + ' and refuses before provider mutations', async () => {
      const f = setup({ fault: hook });
      let answer;
      await expect((async () => { answer = await f.op.handler({ confirm: true }, f.ctx); })())
        .resolves.toBeUndefined();
      const payload = JSON.stringify(answer);
      const result = unwrap(answer);
      expect(answer.isError).toBe(true);
      expect(result.done).toBe(false);
      expect(result.error).toMatch(/unavailable|refused|identifier/);
      expect(payload).not.toContain('SENSITIVE_SENTINEL');
      expect(f.hooks.apply).not.toHaveBeenCalled();
      expect(f.db.recordChange).not.toHaveBeenCalled();
      expect(f.effects).toEqual([]);
    });
  }
  it('retains legitimate guarded preview and explicitly approved TEST action', async () => {
    const f = setup();
    const preview = unwrap(await f.op.handler({dryRun:true}, f.ctx));
    expect(preview).toMatchObject({done:false,mode:'test'});
    expect(f.hooks.apply).not.toHaveBeenCalled();
    const action = unwrap(await f.op.handler({confirm:true}, f.ctx));
    expect(action).toMatchObject({done:true,confirmed:true,mode:'test'});
    expect(f.hooks.beforeApply).toHaveBeenCalledOnce();
    expect(f.hooks.apply).toHaveBeenCalledOnce();
    expect(f.db.recordChange).toHaveBeenCalledTimes(3);
  });
});
