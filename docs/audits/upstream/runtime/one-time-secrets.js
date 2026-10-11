// Never reveal this through an MCP tool. The A-5b setup page authenticates the owner first.
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret, readEncryptionKey } from './crypto.js';

const context = ({ id, account, mode, kind }) => ['stripe-once',id,account || '',mode || '',kind].join('/');
export function createOneTimeStore({ db, encryptionKey = readEncryptionKey() }) {
  return {
    async issue({ account = null, mode = 'test', kind, secret }) {
      if (typeof kind !== 'string' || !kind || typeof secret !== 'string' || !secret) {
        throw new TypeError('Secret type and value are required');
      }
      const id = randomBytes(24).toString('base64url');
      const ciphertext = encryptSecret(secret, { aad: context({ id, account, mode, kind }), key: encryptionKey });
      await db.addOneTimeSecret({ id, account, mode, kind, ciphertext,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
      return { id, setupPath: '/api/stripe/setup?show=' + encodeURIComponent(id) };
    },
    async consume(id) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(id)) return null;
      const row = await db.consumeOneTimeSecret(id);
      if (!row) return null;
      return decryptSecret(row.ciphertext, { aad: context({ id, account: row.stripe_account,
        mode: row.mode, kind: row.kind }), key: encryptionKey });
    }
  };
}
