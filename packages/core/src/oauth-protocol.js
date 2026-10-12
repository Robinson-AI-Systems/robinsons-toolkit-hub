// Protocol-only OAuth endpoints: the owner login UI, account selection and SQL policy live in each service.
// No access to a provider, no default profile/mode and no access-token use outside the service.
import { randomToken, hashToken, secretsMatch, verifyPkce, validRedirectUri } from './oauth.js';
import { publicOrigin, send, paramsOf, only } from './http.js';

const bad = (res, status, error, message) =>
  send(res, status, { error, error_description: message });
const str = value => typeof value === 'string' ? value : '';
const tokenResponse = (access, refresh) => ({
  access_token: access, token_type: 'Bearer', expires_in: 3600, refresh_token: refresh
});

function endpointParams(req) {
  // OAuth input must be an unambiguous JSON data record, not active accessors or
  // repeated form fields that different HTTP stacks may interpret differently.
  if (typeof req?.body === 'string' &&
      typeof req?.headers?.['content-type'] === 'string' &&
      req.headers['content-type'].split(';')[0].trim().toLowerCase() === 'application/x-www-form-urlencoded') {
    const seen = new Set();
    for (const key of new URLSearchParams(req.body).keys()) {
      if (seen.has(key)) throw new TypeError('Ambiguous OAuth form field');
      seen.add(key);
    }
  }
  const params = paramsOf(req);
  const proto = Object.getPrototypeOf(params);
  if (proto !== Object.prototype && proto !== null ||
      Object.getOwnPropertySymbols(params).length) throw new TypeError('Unsafe OAuth input');
  for (const [key, field] of Object.entries(Object.getOwnPropertyDescriptors(params))) {
    if (!field.enumerable || !Object.hasOwn(field, 'value') ||
        ['__proto__', 'prototype', 'constructor'].includes(key)) {
      throw new TypeError('Unsafe OAuth input');
    }
  }
  return params;
}
// Snapshot only ordinary indexed data. Never pass a caller-owned, mutable
// redirect array through service SQL and echo the same reference to the client.
function safeRedirectUris(uris) {
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 8 ||
      Object.getPrototypeOf(uris) !== Array.prototype) return null;
  const fields = Object.getOwnPropertyDescriptors(uris);
  if (Reflect.ownKeys(fields).length !== uris.length + 1) return null;
  const clean = [];
  for (let i = 0; i < uris.length; i++) {
    const item = fields[String(i)];
    if (!item || !item.enumerable || !Object.hasOwn(item, 'value') ||
        typeof item.value !== 'string' || !validRedirectUri(item.value)) return null;
    clean.push(item.value);
  }
  return new Set(clean).size === clean.length ? Object.freeze(clean) : null;
}

// Snapshot all service-selected claims before a durable token receives them.
// Nested accessors, cycles or mutable aliases must never change account/profile
// settings after credentials are issued. Preserve ordinary SQL Date objects.
function copyClaim(value, seen, budget, depth = 0) {
  if (--budget.left < 0 || depth > 12) throw new TypeError('Oversized OAuth claim');
  if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
      value === undefined) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object') throw new TypeError('Unsafe OAuth claim');
  const proto = Object.getPrototypeOf(value);
  if (proto === Date.prototype) {
    if (Reflect.ownKeys(value).length) throw new TypeError('Unsafe OAuth timestamp');
    const ms = Date.prototype.getTime.call(value);
    if (!Number.isFinite(ms)) throw new TypeError('Invalid OAuth timestamp');
    return new Date(ms);
  }
  const array = Array.isArray(value);
  if (array ? proto !== Array.prototype :
      proto !== Object.prototype && proto !== null) throw new TypeError('Unsafe OAuth claim');
  if (seen.has(value)) throw new TypeError('Cyclic OAuth claim');
  seen.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (array && (value.length > 256 || keys.length !== value.length + 1)) {
      throw new TypeError('Unsafe OAuth array');
    }
    const out = array ? [] : Object.create(null);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || ['__proto__','prototype','constructor'].includes(key) ||
          (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) {
        throw new TypeError('Unsafe OAuth claim key');
      }
      const desc = descriptors[key];
      if (!desc.enumerable || !Object.hasOwn(desc,'value')) {
        throw new TypeError('Active OAuth claim');
      }
      out[key] = copyClaim(desc.value, seen, budget, depth + 1);
    }
    return Object.freeze(out);
  } finally {
    seen.delete(value);
  }
}
// These fields originate in service-owned SQL. Read own inert descriptors
// instead of invoking client row getters or accepting a different client id.
function safeClientBinding(row, expectedId) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(row))) return null;
  const fields = Object.getOwnPropertyDescriptors(row);
  const value = name => {
    const field = fields[name];
    return field?.enumerable && Object.hasOwn(field, 'value') ? field.value : null;
  };
  const id = value('client_id');
  const hash = value('client_secret_hash');
  const redirects = safeRedirectUris(value('redirect_uris'));
  if (id !== expectedId || typeof hash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(hash) || !redirects) return null;
  return Object.freeze({ client_id: id, client_secret_hash: hash, redirect_uris: redirects });
}
function safeAccessBinding(row, expected) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(row))) return null;
  const out = copyClaim(row, new Set(), {left: 512});
  for (const [name, expectedValue] of Object.entries(expected)) {
    if (!Object.hasOwn(out,name) || out[name]!==expectedValue) return null;
  }
  return out;
}

const defaultPaths = Object.freeze({ mcp: '/api/mcp', authorize: '/api/oauth/authorize',
  token: '/api/oauth/token', register: '/api/oauth/register' });

export function createOAuthProtocolHandlers({ db, env = process.env, paths = defaultPaths, buildAccessRow }) {
  for (const name of ['createOAuthClient','getOAuthClient','consumeAuthCode','createAccessToken','rotateRefreshToken']) {
    if (typeof db?.[name] !== 'function') throw new TypeError('Durable OAuth storage is required: '+name);
  }
  if (typeof buildAccessRow !== 'function') {
    throw new TypeError('Server-owned access-token claim mapping is required');
  }
  for (const key of ['mcp','authorize','token','register']) {
    if (typeof paths?.[key] !== 'string' || !/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(paths[key])) {
      throw new TypeError('Only absolute local OAuth route paths are supported');
    }
  }
  function resource() { return publicOrigin(env) + paths.mcp; }
  function origin() { return publicOrigin(env); }
  async function register(req, res) {
    if (!only(res, req, ['POST'])) return;
    let p;
    try { p=endpointParams(req); } catch { return bad(res,400,'invalid_client_metadata','Malformed registration'); }
    const redirects = safeRedirectUris(p.redirect_uris);
    if (!redirects) {
      return bad(res,400,'invalid_client_metadata','One to eight valid, distinct redirect URIs required');
    }
    if (p.token_endpoint_auth_method && p.token_endpoint_auth_method !== 'client_secret_post') {
      return bad(res,400,'invalid_client_metadata','Only client_secret_post is supported');
    }
    const id=randomToken(24), secret=randomToken(32);
    await db.createOAuthClient({clientId:id,clientSecret:secret,redirectUris:[...redirects],
      clientName:str(p.client_name).slice(0,100)});
    return send(res,201,{client_id:id,client_secret:secret,client_secret_expires_at:0,
      redirect_uris:[...redirects],token_endpoint_auth_method:'client_secret_post',
      grant_types:['authorization_code','refresh_token'],response_types:['code']});
  }
  async function token(req, res) {
    if (!only(res, req, ['POST'])) return;
    let p;
    try { p=endpointParams(req); } catch { return bad(res,400,'invalid_request','Malformed token request'); }
    if (p.resource !== resource()) {
      return bad(res,400,'invalid_target','Token resource must be this MCP');
    }
    const dbClient = await db.getOAuthClient(str(p.client_id));
    let client = null;
    try { client = safeClientBinding(dbClient, p.client_id); }
    catch { /* refuse malformed service SQL rows without invoking accessors */ }
    if (!client || typeof p.client_secret!=='string' || !p.client_secret ||
      !secretsMatch(hashToken(p.client_secret), client.client_secret_hash)) {
      return bad(res,401,'invalid_client','Client credentials rejected');
    }
    if (p.grant_type === 'authorization_code') {
      if (!p.code || !client.redirect_uris.includes(p.redirect_uri) || !p.code_verifier) {
        return bad(res,400,'invalid_grant','Missing or invalid authorization details');
      }
      const consumed = await db.consumeAuthCode(p.code);
      let record = null;
      try {
        if (consumed && typeof consumed === 'object' && !Array.isArray(consumed) &&
            [Object.prototype,null].includes(Object.getPrototypeOf(consumed))) {
          record = copyClaim(consumed, new Set(), {left: 512});
        }
      } catch { /* malformed durable authorization codes cannot authorize credentials */ }
      if (!record || record.client_id!==p.client_id || record.redirect_uri!==p.redirect_uri ||
        !verifyPkce(p.code_verifier,record.code_challenge,record.code_challenge_method)) {
        return bad(res,400,'invalid_grant','Code is expired, used, or failed PKCE');
      }
      const accessToken=randomToken(32),refreshToken=randomToken(32);
      const mapped=await buildAccessRow({accessToken,refreshToken,clientId:p.client_id,grant:record});
      let bound=null;
      try { bound=safeAccessBinding(mapped,{accessToken,refreshToken,clientId:p.client_id}); }
      catch { /* malformed service mapping cannot become a durable credential */ }
      if (!bound) return bad(res,400,'invalid_grant','Connection settings cannot be issued');
      await db.createAccessToken(bound);
      return send(res,200,tokenResponse(accessToken,refreshToken));
    }
    if (p.grant_type==='refresh_token') {
      if (!str(p.refresh_token)) return bad(res,400,'invalid_grant','Missing refresh token');
      const accessToken=randomToken(32),refreshToken=randomToken(32);
      // Only the durable store may rotate a token; it must copy account/profile/mode/listing.
      const rotated=await db.rotateRefreshToken({refreshToken:p.refresh_token,clientId:p.client_id,
        accessToken,newRefreshToken:refreshToken});
      let verified=null;
      try { verified=safeAccessBinding(rotated,{accessToken,refreshToken,clientId:p.client_id}); }
      catch { /* preserve a generic OAuth denial */ }
      if (!verified) return bad(res,400,'invalid_grant','Refresh credential is expired, used, or revoked');
      return send(res,200,tokenResponse(accessToken,refreshToken));
    }
    return bad(res,400,'unsupported_grant_type','Supported grants: authorization_code and refresh_token');
  }
  function metadata(req,res) {
    if (!only(res,req,['GET'])) return;
    const base=origin();
    return send(res,200,{issuer:base,authorization_endpoint:base+paths.authorize,
      token_endpoint:base+paths.token,registration_endpoint:base+paths.register,
      response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],
      code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['client_secret_post']});
  }
  function resourceMetadata(req,res) {
    if (!only(res,req,['GET'])) return;
    return send(res,200,{resource:resource(),authorization_servers:[origin()]});
  }
  return Object.freeze({register,token,metadata,resourceMetadata});
}
