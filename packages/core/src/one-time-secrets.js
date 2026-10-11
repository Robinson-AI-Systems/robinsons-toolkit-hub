// Portable single-use encrypted-secret persistence; the server owns AAD, route and row mappings.
// Existing service ciphertext MUST be consumed with the identical AAD and key, never reinterpreted.
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret } from './crypto.js';

export function createOneTimeSecretStore({ db, encryptionKey, contextFor, setupPathFor, accountFromRow,
  now = Date.now }) {
  if (typeof db?.addOneTimeSecret !== 'function' || typeof db?.consumeOneTimeSecret !== 'function' ||
      typeof contextFor !== 'function' || typeof setupPathFor !== 'function' ||
      typeof accountFromRow !== 'function' || typeof now !== 'function') {
    throw new TypeError('Durable atomic store and service-specific bindings are required');
  }
  if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
    throw new TypeError('Explicit 32-byte encryption key required');
  }
  return Object.freeze({
    async issue({ account = null, mode = 'test', kind, secret }) {
      if (typeof kind !== 'string' || !kind || typeof secret !== 'string' || !secret) {
        throw new TypeError('Secret type and value are required');
      }
      const id = randomBytes(24).toString('base64url');
      const bound = { id, account, mode, kind };
      const aad = contextFor(bound);
      const path = setupPathFor(id);
      if (typeof aad !== 'string' || !aad || typeof path !== 'string' ||
          !/^\/(?!\/)[^\s#]*$/.test(path)) {
        throw new TypeError('A service-bound encryption context and relative setup route are required');
      }
      const ciphertext = encryptSecret(secret, { aad, key: encryptionKey });
      await db.addOneTimeSecret({ ...bound, ciphertext, expiresAt: new Date(now() + 600000) });
      return { id, setupPath: path };
    },
    async consume(id) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(id)) return null;
      // The durable store must atomically consume only an unexpired row.
      const row = await db.consumeOneTimeSecret(id);
      if (!row) return null;
      const aad = contextFor({ id, account: accountFromRow(row), mode: row.mode, kind: row.kind });
      return decryptSecret(row.ciphertext, { aad, key: encryptionKey });
    }
  });
}
