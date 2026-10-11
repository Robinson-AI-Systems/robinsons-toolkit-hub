import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret, readEncryptionKey } from '../../src/core/crypto.js';
import { createKeyStore } from '../../src/keys.js';
import { createOneTimeStore } from '../../src/core/one-time-secrets.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';
import { makeFakeStripe } from '../../test/helpers/fake-stripe.js';

const generate = () => randomBytes(32);
const testKey = () => ['rk', 'test', 'FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
describe('A-5a encrypted server-only credentials', () => {
  it('requires an exact 32-byte encryption key, without a plaintext fallback', () => {
    expect(() => readEncryptionKey({})).toThrow(/TOKEN_ENCRYPTION_KEY/);
    expect(() => readEncryptionKey({ TOKEN_ENCRYPTION_KEY: 'not-a-key' })).toThrow(/32-byte/);
    expect(readEncryptionKey({ TOKEN_ENCRYPTION_KEY: generate().toString('base64') })).toHaveLength(32);
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
  it('stores a provider-verified test key encrypted; public metadata never contains key', async () => {
    const key = generate(), db = createFakeDb(), { stripe, calls, when } = makeFakeStripe();
    when('accounts.retrieve').resolves({ id:'acct_FAKE123', business_profile:{name:'Personal test'} });
    const store = createKeyStore({ db, encryptionKey:key, makeClient: () => stripe, probe: async () => ({}) });
    const secret = testKey();
    const details = await store.storeTestKey({ key:secret });
    expect(details).toEqual({ account:'acct_FAKE123', label:'Personal test',
      mode:'test', kind:'restricted', last4:secret.slice(-4) });
    expect(JSON.stringify(details)).not.toContain(secret);
    expect((await db.getEncryptedKey({ account:'acct_FAKE123', mode:'test' })).ciphertext).not.toContain(secret);
    expect(await store.loadKey({ account:'acct_FAKE123' })).toBe(secret);
    expect(calls[0].path).toBe('accounts.retrieve');
    expect((await db.listStripeAccounts())[0]).toMatchObject({ id:'acct_FAKE123', label:'Personal test',
      is_default:true, live_enabled:false });
    await expect(store.loadKey({ account:'missing' })).rejects.toThrow(/No test key/);
    await expect(store.loadKey({ account:'acct_FAKE123', mode:'live' })).rejects.toThrow(/not enabled/);
    await expect(store.storeTestKey({ key:['sk','live','FAKE'].join('_') })).rejects.toThrow(/Only a Stripe test/);
  });
  it('issues encrypted one-time records and returns only a setup link, then consumes once', async () => {
    const db = createFakeDb(), key = generate();
    const vault = createOneTimeStore({ db, encryptionKey:key });
    const secret = 'one-time-fixture-value';
    const issued = await vault.issue({ account:'acct_FAKE123', kind:'webhook-signing-secret', secret });
    expect(JSON.stringify(issued)).not.toContain(secret);
    expect(issued.setupPath).toMatch(/^\/api\/stripe\/setup\?show=/);
    expect(await vault.consume(issued.id)).toBe(secret);
    expect(await vault.consume(issued.id)).toBeNull();
    expect(await vault.consume('invalid')).toBeNull();
  });
});
