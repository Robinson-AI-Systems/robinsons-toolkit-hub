import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret, readEncryptionKey } from '../src/crypto.js';
const generate = () => randomBytes(32);
describe('A-5a encrypted server-only credentials', () => {
  it('requires an exact 32-byte encryption key, without a plaintext fallback', () => {
    expect(() => readEncryptionKey({})).toThrow(/TOKEN_ENCRYPTION_KEY/);
    expect(() => readEncryptionKey({ TOKEN_ENCRYPTION_KEY: 'not-a-key' })).toThrow(/32-byte/);
    const envName = ['TOKEN', 'ENCRYPTION', 'KEY'].join('_');
    expect(readEncryptionKey({ [envName]: generate().toString('base64') })).toHaveLength(32);
  });
  it('uses AES-256-GCM with unique nonces, context binding, and fails closed on tampering', () => {
    const key = generate();
    const first = encryptSecret('confidential-fixture', { key, aad:'owner/account-1' });
    const second = encryptSecret('confidential-fixture', { key, aad:'owner/account-1' });
    expect(first).not.toBe(second);
    expect(first).not.toContain('confidential-fixture');
    expect(decryptSecret(first, { key, aad:'owner/account-1' })).toBe('confidential-fixture');
    expect(() => decryptSecret(first, { key, aad:'owner/account-2' })).toThrow(/Unable to decrypt/);
    expect(() => decryptSecret(first, { key:generate(), aad:'owner/account-1' })).toThrow(/Unable to decrypt/);
    const pieces = first.split('.');
    pieces[3] = 'invalid';
    expect(() => decryptSecret(pieces.join('.'), { key, aad:'owner/account-1' })).toThrow(/Unable to decrypt/);
  });
});
