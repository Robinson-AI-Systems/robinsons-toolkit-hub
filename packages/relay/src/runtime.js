import { createPrivateKey } from 'node:crypto';
import pg from 'pg';
import { createRelayServer } from './server.js';
import { createReplayStore } from './store.js';
import { createForwarder, validateServerUrl } from './forward.js';
import { githubCommentTransport } from '../../cli/src/relay.js';

function objectFrom(text, label) {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new Error('Invalid relay ' + label + ' configuration'); }
}
export function relaySettings(env = process.env) {
  const repo = env.RELAY_REPOSITORY;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || ''))
    throw new Error('Relay repository configuration required');
  const secret = env.RELAY_WEBHOOK_SECRET;
  const token = env.RELAY_GITHUB_TOKEN;
  if (typeof secret !== 'string' || secret.length < 32 || !token?.trim())
    throw new Error('Relay authorization configuration required');
  const servers = objectFrom(env.RELAY_SERVERS, 'servers');
  const bindings = objectFrom(env.RELAY_BINDINGS, 'bindings');
  if (!Object.keys(servers).length || !Object.keys(bindings).length)
    throw new Error('Relay needs explicit server and agent bindings');
  for (const [name, url] of Object.entries(servers)) {
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(name)) throw new Error('Invalid relay server alias');
    servers[name] = validateServerUrl(url);
  }
  for (const [issue, value] of Object.entries(bindings)) {
    if (!/^[1-9][0-9]*$/.test(issue) || !Number.isSafeInteger(Number(issue)) ||
        !Number.isSafeInteger(value?.actorId) || value.actorId < 1 ||
        typeof value.server !== 'string' || !Object.hasOwn(servers, value.server))
      throw new Error('Invalid relay issue binding');
  }
  let privateKey;
  try {
    privateKey = createPrivateKey({ key: Buffer.from(env.RELAY_PRIVATE_KEY || '', 'base64'),
      format: 'der', type: 'pkcs8' });
    if (privateKey.asymmetricKeyType !== 'x25519') throw new Error();
  } catch { throw new Error('Relay X25519 private key configuration required'); }
  let database;
  try {
    database = new URL(env.RELAY_DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname ||
        ['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
        !['require', 'verify-full'].includes(database.searchParams.get('sslmode'))) throw new Error();
  } catch { throw new Error('Relay encrypted Postgres connection required'); }
  return { repo, secret, token, servers, bindings, privateKey, databaseUrl: database.href };
}
export function createRelayRuntime({ env = process.env, poolFactory = (url) =>
  new pg.Pool({ connectionString: url, max: 3, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000, query_timeout: 5000 }), fetchImpl = fetch } = {}) {
  let runtime;
  return () => {
    if (runtime) return runtime;
    const settings = relaySettings(env);
    const pool = poolFactory(settings.databaseUrl);
    // Pool emits connection errors; never leak driver messages (may include credentials).
    pool.on?.('error', () => {});
    const store = createReplayStore(pool);
    const transportFor = (issue) => githubCommentTransport({
      repo: settings.repo, issue, token: settings.token, fetchImpl });
    const handle = createRelayServer({ ...settings, store,
      forward: createForwarder({ servers: settings.servers, fetchImpl }), transportFor });
    runtime = { handle, store, settings, transportFor, close: () => pool.end() };
    return runtime;
  };
}
