// Protocol-only OAuth endpoints: the owner login UI, account selection and SQL policy live in each service.
// No access to a provider, no default profile/mode and no access-token use outside the service.
import { randomToken, hashToken, secretsMatch, verifyPkce, validRedirectUri } from './oauth.js';
import { publicOrigin, send, paramsOf, only } from './http.js';
import { authorizationHeaderEvidence, allowBrowserProtocol } from './mcp-auth.js';


export const MAX_OAUTH_BODY_BYTES = 16 * 1024;
// Mirror current source transport evidence without changing the older pinned
// byte-identical HTTP helper. Hosts must supply rawBody or a trusted length
// before relying on byte-exact acceptance for pre-parsed framework requests.
// Reject ambiguous HTTP framing before reading a framework-preparsed body or
// letting a token handler reach durable storage. Inspect descriptors, never
// invoke request/header accessors supplied by a caller.
function oauthTransportFrame(req) {
  if (!req || typeof req !== 'object') return null;
  for (const key of ['headers','rawHeaders','rawBody','body']) {
    const own = Object.getOwnPropertyDescriptor(req,key);
    if (own && !Object.hasOwn(own,'value')) return null;
  }
  const headers=req.headers;
  if (!headers || ![Object.prototype,null].includes(Object.getPrototypeOf(headers))) return null;
  const descriptors=Object.getOwnPropertyDescriptors(headers);
  const selected=new Map();
  const names=['content-length','content-type','transfer-encoding'];
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key!=='string') return null;
    const lower=key.toLowerCase();
    if (!names.includes(lower)) continue;
    const descriptor=descriptors[key];
    if (key!==lower || selected.has(lower) || !descriptor.enumerable ||
        !Object.hasOwn(descriptor,'value') || typeof descriptor.value!=='string') return null;
    selected.set(lower,descriptor.value);
  }
  if (req.rawHeaders!==undefined) {
    const raw=req.rawHeaders;
    if (!Array.isArray(raw) || Object.getPrototypeOf(raw)!==Array.prototype ||
        raw.length%2!==0 || raw.length>128) return null;
    const found=new Map();
    for (let i=0;i<raw.length;i+=2) {
      const name=Object.getOwnPropertyDescriptor(raw,String(i));
      const value=Object.getOwnPropertyDescriptor(raw,String(i+1));
      if (!name || !value || !Object.hasOwn(name,'value') ||
          !Object.hasOwn(value,'value') || typeof name.value!=='string' ||
          typeof value.value!=='string') return null;
      const lower=name.value.toLowerCase();
      if (!names.includes(lower)) continue;
      if (found.has(lower)) return null;
      found.set(lower,value.value);
    }
    for (const name of names) {
      if (found.has(name) && (!selected.has(name) ||
          found.get(name)!==selected.get(name))) return null;
    }
  }
  if (selected.has('transfer-encoding') && selected.has('content-length')) return null;
  const supplied=selected.get('content-length');
  let declared;
  if (supplied!==undefined) {
    if (!/^(0|[1-9][0-9]*)$/.test(supplied)) return null;
    declared=Number(supplied);
    if (!Number.isSafeInteger(declared) || declared>MAX_OAUTH_BODY_BYTES) return null;
  }
  return Object.freeze({declared});
}

export function oauthTransportBodyWithinLimit(req) {
  if (req.method !== 'POST') return true;
  const frame=oauthTransportFrame(req);
  if (!frame) return false;
  const declared=frame.declared;
  const raw=req.rawBody;
  if (raw !== undefined) {
    if (typeof raw !== 'string' && !Buffer.isBuffer(raw)) return false;
    const bytes=Buffer.byteLength(raw);
    if (bytes>MAX_OAUTH_BODY_BYTES || declared!==undefined && bytes!==declared) return false;
  } else if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    const bytes=Buffer.byteLength(req.body);
    if (bytes>MAX_OAUTH_BODY_BYTES || declared!==undefined && bytes!==declared) return false;
  } else if (declared===undefined && req.body && typeof req.body==='object') {
    return false;
  }
  return true;
}

const bad = (res, status, error, message) =>
  send(res, status, { error, error_description: message });
const str = value => typeof value === 'string' ? value : '';
const tokenResponse = (access, refresh) => ({
  access_token: access, token_type: 'Bearer', expires_in: 3600, refresh_token: refresh
});

function endpointParams(req) {
  // The portable endpoint refuses contradictory raw/declared evidence. Exact
  // raw-byte enforcement for pre-parsed requests without either belongs to
  // the host adapter; never infer a raw length by reserializing input.
  const frame=oauthTransportFrame(req);
  if (!frame || (req.rawBody !== undefined || frame.declared !== undefined) &&
      !oauthTransportBodyWithinLimit(req)) throw new TypeError('Invalid OAuth wire body');
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
  // The framework may pre-parse a JSON request before its real byte count
  // becomes available. Refuse active/cyclic/oversized semantic data without
  // trusting JSON.stringify on caller-owned objects. The service must still
  // enforce its transport's exact raw-byte limit before credential lookup.
  const snapshot=copyClaim(params,new Set(),{left:512},0,false);
  if(Buffer.byteLength(JSON.stringify(snapshot),'utf8')>MAX_OAUTH_BODY_BYTES) {
    throw new TypeError('Oversized OAuth input');
  }
  return snapshot;
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
        typeof item.value !== 'string' ||
        Buffer.byteLength(item.value, 'utf8') > 2048 || !validRedirectUri(item.value)) return null;
    clean.push(item.value);
  }
  return new Set(clean).size === clean.length ? Object.freeze(clean) : null;
}

// Snapshot all service-selected claims before a durable token receives them.
// Nested accessors, cycles or mutable aliases must never change account/profile
// settings after credentials are issued. Preserve ordinary SQL Date objects.
function copyClaim(value, seen, budget, depth = 0, allowDate = true) {
  if (--budget.left < 0 || depth > 12) throw new TypeError('Oversized OAuth claim');
  if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
      value === undefined) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object') throw new TypeError('Unsafe OAuth claim');
  const proto = Object.getPrototypeOf(value);
  if (proto === Date.prototype) {
    if (!allowDate) throw new TypeError('Date is not OAuth request JSON');
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
      out[key] = copyClaim(desc.value, seen, budget, depth + 1, allowDate);
    }
    return Object.freeze(out);
  } finally {
    seen.delete(value);
  }
}
// These fields originate in service-owned SQL. Read own inert descriptors
// instead of invoking client row getters or accepting a different client id.
// Header credentials are an alternate client authentication mechanism, never
// a second body secret. Reject noncanonical encodings before durable SQL reads.
function basicCredentials(req) {
  const evidence=authorizationHeaderEvidence(req);
  if(!evidence.valid) return null;
  if(evidence.value===undefined) return {present:false,basic:null};
  const match=/^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(evidence.value);
  if(!match) return {present:true,basic:null};
  const bytes=Buffer.from(match[1],'base64');
  const value=bytes.toString('utf8'),colon=value.indexOf(':');
  if(bytes.toString('base64')!==match[1] || !Buffer.from(value,'utf8').equals(bytes) ||
      colon<1 || colon!==value.lastIndexOf(':')) return {present:true,basic:null};
  return {present:true,basic:{id:value.slice(0,colon),secret:value.slice(colon+1)}};
}

function safeClientBinding(row, expectedId) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(row))) return null;
  const fields = Object.getOwnPropertyDescriptors(row);
  const value = name => {
    const field = fields[name];
    return field?.enumerable && Object.hasOwn(field, 'value') ? field.value : null;
  };
  const id = value('client_id');
  const secretField = fields.client_secret_hash;
  if (!secretField || !secretField.enumerable || !Object.hasOwn(secretField, 'value')) return null;
  const hash = secretField.value;
  const redirects = safeRedirectUris(value('redirect_uris'));
  const methodField = fields.token_endpoint_auth_method;
  if (methodField && (!methodField.enumerable || !Object.hasOwn(methodField, 'value'))) return null;
  // Legacy source SQL clients defaulted to POST; public clients deliberately have no hash.
  const method = methodField ? methodField.value : 'client_secret_post';
  if (id !== expectedId || !redirects ||
      !['client_secret_post', 'client_secret_basic', 'none'].includes(method) ||
      (method === 'none' ? hash !== null :
        typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) return null;
  return Object.freeze({ client_id: id, client_secret_hash: hash,
    token_endpoint_auth_method: method, redirect_uris: redirects });
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
    if (allowBrowserProtocol(req,res,{methods:['POST']})) return;
    if (!only(res, req, ['POST'])) return;
    let p;
    try { p=endpointParams(req); } catch { return bad(res,400,'invalid_client_metadata','Malformed registration'); }
    const redirects = safeRedirectUris(p.redirect_uris);
    if (!redirects) {
      return bad(res,400,'invalid_client_metadata','One to eight valid, distinct redirect URIs required');
    }
    if (p.client_name !== undefined && (typeof p.client_name !== 'string' ||
        p.client_name.length > 100 || /[\x00-\x1f\x7f]/.test(p.client_name))) {
      return bad(res,400,'invalid_client_metadata','Client name must be printable and at most 100 characters');
    }
    if (p.response_types !== undefined && (!Array.isArray(p.response_types) ||
        p.response_types.length !== 1 || p.response_types[0] !== 'code')) {
      return bad(res,400,'invalid_client_metadata','Only authorization code response type is supported');
    }
    if (p.grant_types !== undefined && (!Array.isArray(p.grant_types) ||
        !p.grant_types.includes('authorization_code') || p.grant_types.length > 2 ||
        new Set(p.grant_types).size !== p.grant_types.length ||
        !p.grant_types.every(x => ['authorization_code','refresh_token'].includes(x)))) {
      return bad(res,400,'invalid_client_metadata','Unsupported or duplicate grant types');
    }
    // Explicit BASIC and public PKCE are supported. Existing portable clients
    // default to POST pending independent service-owned migration/acceptance.
    const method = p.token_endpoint_auth_method ?? 'client_secret_post';
    if (!['client_secret_post','client_secret_basic','none'].includes(method)) {
      return bad(res,400,'invalid_client_metadata','Unsupported client authentication');
    }
    const id=randomToken(24), secret=method==='none' ? null : randomToken(32);
    await db.createOAuthClient({clientId:id,clientSecret:secret,
      tokenEndpointAuthMethod:method,redirectUris:[...redirects],clientName:str(p.client_name)});
    return send(res,201,{client_id:id,
      ...(secret ? {client_secret:secret,client_secret_expires_at:0} : {}),
      redirect_uris:[...redirects],token_endpoint_auth_method:method,
      grant_types:['authorization_code','refresh_token'],response_types:['code']});
  }
  async function token(req, res) {
    if (allowBrowserProtocol(req,res,{methods:['POST']})) return;
    if (!only(res, req, ['POST'])) return;
    let p;
    try { p=endpointParams(req); } catch { return bad(res,400,'invalid_request','Malformed token request'); }
    if (p.resource !== resource()) {
      return bad(res,400,'invalid_target','Token resource must be this MCP');
    }
    const auth = basicCredentials(req);
    if (!auth || auth.present && !auth.basic) {
      if (auth?.present) res.setHeader('WWW-Authenticate', 'Basic realm="MCP OAuth"');
      return bad(res,401,'invalid_client','Client credentials rejected');
    }
    const clientId = auth.basic?.id || str(p.client_id);
    const dbClient = await db.getOAuthClient(clientId);
    let client = null;
    try { client = safeClientBinding(dbClient, clientId); }
    catch { /* refuse malformed service SQL rows without invoking accessors */ }
    const method = client?.token_endpoint_auth_method;
    const publicOk = method === 'none' && !auth.present &&
      (p.client_secret === undefined || p.client_secret === '');
    const postOk = method === 'client_secret_post' && !auth.present &&
      typeof p.client_secret === 'string' && !!p.client_secret &&
      secretsMatch(hashToken(p.client_secret), client.client_secret_hash);
    const basicOk = method === 'client_secret_basic' && !!auth.basic &&
      (p.client_id === undefined || p.client_id === clientId) &&
      p.client_secret === undefined && !!auth.basic.secret &&
      secretsMatch(hashToken(auth.basic.secret), client.client_secret_hash);
    if (!client || !(publicOk || postOk || basicOk)) {
      if (auth.present) res.setHeader('WWW-Authenticate', 'Basic realm="MCP OAuth"');
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
      if (!record || record.client_id!==clientId || record.redirect_uri!==p.redirect_uri ||
        !verifyPkce(p.code_verifier,record.code_challenge,record.code_challenge_method)) {
        return bad(res,400,'invalid_grant','Code is expired, used, or failed PKCE');
      }
      const accessToken=randomToken(32),refreshToken=randomToken(32);
      const mapped=await buildAccessRow({accessToken,refreshToken,clientId,grant:record});
      let bound=null;
      try { bound=safeAccessBinding(mapped,{accessToken,refreshToken,clientId}); }
      catch { /* malformed service mapping cannot become a durable credential */ }
      if (!bound) return bad(res,400,'invalid_grant','Connection settings cannot be issued');
      await db.createAccessToken(bound);
      return send(res,200,tokenResponse(accessToken,refreshToken));
    }
    if (p.grant_type==='refresh_token') {
      if (!str(p.refresh_token)) return bad(res,400,'invalid_grant','Missing refresh token');
      const accessToken=randomToken(32),refreshToken=randomToken(32);
      // Only the durable store may rotate a token; it must copy account/profile/mode/listing.
      const rotated=await db.rotateRefreshToken({refreshToken:p.refresh_token,clientId,
        accessToken,newRefreshToken:refreshToken});
      let verified=null;
      try { verified=safeAccessBinding(rotated,{accessToken,refreshToken,clientId}); }
      catch { /* preserve a generic OAuth denial */ }
      if (!verified) return bad(res,400,'invalid_grant','Refresh credential is expired, used, or revoked');
      return send(res,200,tokenResponse(accessToken,refreshToken));
    }
    return bad(res,400,'unsupported_grant_type','Supported grants: authorization_code and refresh_token');
  }
  function metadata(req,res) {
    if (allowBrowserProtocol(req,res,{methods:['GET']})) return;
    if (!only(res,req,['GET'])) return;
    const base=origin();
    return send(res,200,{issuer:base,authorization_endpoint:base+paths.authorize,
      token_endpoint:base+paths.token,registration_endpoint:base+paths.register,
      response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],
      code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['client_secret_post','client_secret_basic','none']});
  }
  function resourceMetadata(req,res) {
    if (allowBrowserProtocol(req,res,{methods:['GET']})) return;
    if (!only(res,req,['GET'])) return;
    return send(res,200,{resource:resource(),authorization_servers:[origin()]});
  }
  return Object.freeze({register,token,metadata,resourceMetadata});
}
