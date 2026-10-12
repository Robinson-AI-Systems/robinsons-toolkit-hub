// Never persist a pass: servers.json holds only URLs; passes are provided by the
// environment or an OS keychain adapter added by the dedicated login card.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const serverName = /^[a-z][a-z0-9_-]{0,39}$/;
// Hyphen and underscore aliases normalize to the same pass environment slot.
// Reject ambiguity BEFORE loading or using any server credentials.
export const credentialSlot = (name) =>
  'RTOOL_PASS_' + name.toUpperCase().replaceAll('-', '_');
const secretKey = credentialSlot;
export function assertDistinctCredentialSlots(names) {
  const seen = new Map();
  for (const name of names) {
    const key = credentialSlot(name);
    if (seen.has(key) && seen.get(key) !== name) {
      throw new RouteError('Server aliases share a credential slot');
    }
    seen.set(key, name);
  }
}
export class RouteError extends Error {
  constructor(message) { super(message); this.name = 'RouteError'; this.exitCode = 6; }
}
export function validateUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new RouteError('Invalid server URL'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && local)) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new RouteError('Server URL must be HTTPS (or loopback HTTP), with no credentials or query');
  }
  return url.origin;
}
export function parseEnvServers(value) {
  const map = new Map();
  if (!value) return map;
  for (const entry of value.split(',')) {
    const at = entry.indexOf('=');
    if (at <= 0) throw new RouteError('RTOOL_SERVERS must contain name=URL entries');
    const name = entry.slice(0, at).trim();
    if (!serverName.test(name) || map.has(name)) throw new RouteError('Invalid or duplicate server name');
    map.set(name, validateUrl(entry.slice(at + 1).trim()));
  }
  assertDistinctCredentialSlots(map.keys());
  return map;
}
export function configPath(env = process.env) {
  return join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'rtool', 'servers.json');
}
export async function loadServers(env = process.env, reader = readFile) {
  const map = new Map();
  try {
    const parsed = JSON.parse(await reader(configPath(env), 'utf8'));
    const servers = parsed?.servers;
    if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
      throw new RouteError('servers.json requires an object named servers');
    }
    for (const [name, value] of Object.entries(servers)) {
      if (!serverName.test(name)) throw new RouteError('Invalid stored server name');
      if (typeof value !== 'string') throw new RouteError('Server URLs must be strings');
      map.set(name, validateUrl(value));
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  for (const [name, url] of parseEnvServers(env.RTOOL_SERVERS)) map.set(name, url);
  assertDistinctCredentialSlots(map.keys());
  return map;
}
export function passFor(name, env = process.env) {
  return env[secretKey(name)] || null;
}
export function displayServers(servers, env = process.env) {
  return [...servers].map(([name, url]) => ({
    name, url, passConfigured: Boolean(passFor(name, env))
  }));
}
