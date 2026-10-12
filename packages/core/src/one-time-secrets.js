// Portable single-use encrypted-secret persistence; the server owns AAD, route and row mappings.
// Existing service ciphertext MUST be consumed with the identical AAD and key, never reinterpreted.
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret } from './crypto.js';

// A service chooses the route shape, but must link to this newly issued secret.
// Never normalize a service-provided setup link to another path/authority.
function safeSetupPath(path, id) {
  if (typeof path !== 'string' || !/^\/(?!\/)[^\s#]*$/.test(path) || !path.includes(id)) {
    return false;
  }
  const pathname = path.split('?')[0];
  if (pathname.includes('\\') || pathname.includes('//') ||
      /%(?:2e|2f|5c)/i.test(pathname) ||
      pathname.split('/').some(segment => segment === '.' || segment === '..')) {
    return false;
  }
  try {
    const url = new URL(path, 'https://core.invalid');
    if (url.origin !== 'https://core.invalid' || url.pathname !== pathname) return false;
    // The issued identifier must be an entire route segment or an entire query
    // value. A prefix/suffix/key-name hit is not a usable one-time reveal URL.
    // Multiple matches also make the service's selector ambiguous.
    const pathMatches = pathname.split('/').filter(segment => segment === id).length;
    const queryEntries = [...url.searchParams.entries()];
    const queryMatches = queryEntries.filter(([, value]) => value === id);
    // A single matching value inside two values of the same parameter is not
    // an unambiguous service selector (URLSearchParams.get picks the first).
    // Decode names before comparison, so %73how and show cannot bypass it.
    if (queryMatches.some(([key]) => url.searchParams.getAll(key).length !== 1)) {
      return false;
    }
    return pathMatches + queryMatches.length === 1;
  } catch { return false; }
}

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
      if (typeof kind !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(kind) ||
          typeof secret !== 'string' || !secret) {
        throw new TypeError('Secret type and value are required');
      }
      if ((account !== null && (typeof account !== 'string' ||
          !account.trim() || account.length > 256 || /[\x00-\x1f\x7f]/.test(account))) ||
          !['test', 'live'].includes(mode)) {
        throw new TypeError('Valid service account and test/live mode are required');
      }
      const clock = now();
      if (!Number.isSafeInteger(clock) || clock < 0 || clock > 8640000000000000 - 600000) {
        throw new TypeError('Valid issuance clock required');
      }
      const id = randomBytes(24).toString('base64url');
      const bound = Object.freeze({ id, account, mode, kind });
      const aad = contextFor(bound);
      const path = setupPathFor(id);
      if (typeof aad !== 'string' || !aad || !safeSetupPath(path, id)) {
        throw new TypeError('A service-bound encryption context and relative setup route are required');
      }
      const ciphertext = encryptSecret(secret, { aad, key: encryptionKey });
      await db.addOneTimeSecret({ ...bound, ciphertext, expiresAt: new Date(clock + 600000) });
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
