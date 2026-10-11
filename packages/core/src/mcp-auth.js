// Service-neutral bearer gate: storage, policy and identity projection remain server owned.
// An invalid bearer must never reach a provider handler or leak its token to MCP claims.
import { publicOrigin, send } from './http.js';

const bearer = /^Bearer ([A-Za-z0-9_-]{30,256})$/;
export function createMcpBearerAuthenticator({ getAccessToken, projectConnection, env = process.env }) {
  if (typeof getAccessToken !== 'function' || typeof projectConnection !== 'function') {
    throw new TypeError('A token lookup and server-owned connection policy are required');
  }
  return async function authenticate(req, res) {
    const challenge = 'Bearer resource_metadata="' +
      publicOrigin(env) + '/.well-known/oauth-protected-resource"';
    const match = bearer.exec(String(req?.headers?.authorization || ''));
    if (!match) {
      res.setHeader('WWW-Authenticate', challenge);
      send(res, 401, { error: 'unauthorized', error_description: 'A valid connection is required' });
      return null;
    }
    // The server owns durable expiry/revocation/lockout/account validation.
    const record = await getAccessToken(match[1]);
    let projected = null;
    if (record) {
      try { projected = await projectConnection(record); } catch { projected = null; }
    }
    if (!projected || typeof projected !== 'object' || Array.isArray(projected) ||
      !Object.keys(projected).length) {
      res.setHeader('WWW-Authenticate', challenge + ', error="invalid_token"');
      send(res, 401, { error: 'invalid_token' });
      return null;
    }
    // Only explicitly projected claims cross the boundary. The bearer itself is never returned.
    return Object.freeze({ ...projected });
  };
}
