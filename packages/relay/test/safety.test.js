import { it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { safeRelayResult } from '../src/safety.js';
import { generateRelayKeys, sealRequest } from '../src/crypto.js';
import { encodeRelayComment } from '../../cli/src/relay.js';
it('redacts accidentally echoed pass in deeply nested service results', () => {
  const pass = 'rtc_pass_' + randomBytes(32).toString('base64url');
  const result = safeRelayResult({ ok: true, result: { a: [{ reflected: pass, harmless: 'unchanged' }] } }, pass);
  expect(JSON.stringify(result)).not.toContain(pass);
  expect(result.result.a[0].harmless).toBe('unchanged');
});
it('refuses bodies larger than GitHub comment limits before posting', () => {
  expect(() => encodeRelayComment('request', { ciphertext: 'x'.repeat(65536) })).toThrow('body cap');
  const key = generateRelayKeys().publicKey;
  const pass = 'rtc_pass_' + randomBytes(32).toString('base64url');
  expect(() => sealRequest({ publicKey: key, server: 'fake', tool: 'fake_read', pass,
    args: { value: 'x'.repeat(42 * 1024) } })).toThrow('size cap');
});
