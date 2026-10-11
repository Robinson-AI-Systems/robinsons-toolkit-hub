import { RouteError, passFor } from './config.js';
import { relayRoute } from './relay-route.js';
import { contract, httpRequest } from './http.js';

export async function selectServer(servers, env, requested) {
  const named = requested.includes('.') ? requested.split('.', 2) : null;
  if (named) {
    const [name, tool] = named;
    if (!servers.has(name) || !tool) throw new RouteError('Unknown qualified tool: ' + requested);
    return { ...byName(servers, env, name), tool };
  }
  const discovery = await Promise.allSettled([...servers].map(async ([name, url]) => ({
    name, url, prefix: (await contract(url, passFor(name, env), relayRoute(name, env, env.relayNotice))).prefix
  })));
  const candidates = discovery.filter((x) => x.status === 'fulfilled')
    .map((x) => x.value).filter((s) => requested.startsWith(s.prefix + '_'));
  if (candidates.length !== 1) {
    throw new RouteError(candidates.length ? 'Several servers share this prefix; qualify as server.tool' :
      'No configured server owns the tool prefix');
  }
  const { name, url } = candidates[0];
  return { ...byName(servers, env, name), tool: requested, url };
}
export function requirePass(server) {
  if (!server.pass) throw new RouteError('No pass configured for ' + server.name +
    ' (set RTOOL_PASS_' + server.name.toUpperCase().replaceAll('-', '_') + ')');
  return server.pass;
}
export function byName(servers, env, name) {
  if (!servers.has(name)) throw new RouteError('Unknown configured server: ' + name);
  return { name, url: servers.get(name), pass: passFor(name, env), fallback: relayRoute(name, env, env.relayNotice) };
}
export async function send(server, path, opts = {}) {
  return httpRequest(server.url, requirePass(server), path, { ...opts, fallback: server.fallback });
}
