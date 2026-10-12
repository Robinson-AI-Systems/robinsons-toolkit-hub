// Service-neutral bearer gate: storage, policy and identity projection remain server owned.
// An invalid bearer must never reach a provider handler or leak its token to MCP claims.
import { publicOrigin, send } from './http.js';

const bearer = /^Bearer ([A-Za-z0-9_-]{30,256})$/;
const secretField=/(?:token|secret|passphrase|password|authorization|credential|(?:api|private)[_-]?key)/i;

// Service projection is privileged input, but a mistaken projector must never
// return the submitted bearer or a mutable/active credential-bearing object.
function isolatedClaims(raw,submittedToken){
  const seen=new WeakSet();
  let nodes=0;
  function clone(value,depth){
    if(++nodes>256||depth>6)throw new TypeError('Unsafe connection identity');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='string'){
      if(value.includes(submittedToken))throw new TypeError('Credential leaked by projector');
      return value;
    }
    if(typeof value==='number'&&Number.isFinite(value))return value;
    if(typeof value!=='object')throw new TypeError('Unsupported connection identity');
    if(seen.has(value))throw new TypeError('Cyclic connection identity');
    seen.add(value);
    const array=Array.isArray(value);
    const proto=Object.getPrototypeOf(value);
    if(!array&&proto!==Object.prototype&&proto!==null){
      throw new TypeError('Non-plain connection identity');
    }
    if(Object.getOwnPropertySymbols(value).length)throw new TypeError('Symbol claim refused');
    if(array){
      if(value.length>128)throw new TypeError('Oversized claim list');
      const out=[];
      for(let i=0;i<value.length;i++){
        const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
        if(!descriptor||!Object.hasOwn(descriptor,'value'))throw new TypeError('Accessor claim refused');
        out.push(clone(descriptor.value,depth+1));
      }
      return Object.freeze(out);
    }
    const out={};
    for(const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))){
      if(key==='__proto__'||key==='constructor'||key==='prototype'||secretField.test(key)||
        !descriptor.enumerable||!Object.hasOwn(descriptor,'value')) {
        throw new TypeError('Untrusted connection claim field');
      }
      out[key]=clone(descriptor.value,depth+1);
    }
    return Object.freeze(out);
  }
  const claims=clone(raw,0);
  if(!claims||Array.isArray(claims)||typeof claims!=='object'||!Object.keys(claims).length||
    Buffer.byteLength(JSON.stringify(claims))>8192){
    throw new TypeError('Empty or oversized connection identity');
  }
  return claims;
}


// A single inert Node Authorization header proof used by bearer and OAuth
// Basic flows. Reject duplicate/mixed-case normalized, distinct or raw evidence.
// Never choose one credential among conflicting HTTP representations.
export function authorizationHeaderEvidence(req) {
  const invalid = {valid:false,value:null};
  try {
    const headers=req?.headers;
    if(!headers || ![Object.prototype,null].includes(Object.getPrototypeOf(headers))) return invalid;
    const descriptors=Object.getOwnPropertyDescriptors(headers);
    let header;
    for(const key of Reflect.ownKeys(descriptors)) {
      if(typeof key==='string' && key.toLowerCase()==='authorization') {
        if(key!=='authorization' || header!==undefined ||
            !Object.hasOwn(descriptors[key],'value') ||
            typeof descriptors[key].value!=='string') return invalid;
        header=descriptors[key].value;
      }
    }
    const distinct=req?.headersDistinct;
    if(distinct!==undefined) {
      if(!distinct || ![Object.prototype,null].includes(Object.getPrototypeOf(distinct))) return invalid;
      const d=Object.getOwnPropertyDescriptors(distinct);
      if(Reflect.ownKeys(d).some(key=>typeof key==='string' &&
          key.toLowerCase()==='authorization' && key!=='authorization')) return invalid;
      const auth=d.authorization;
      if(header!==undefined) {
        if(!auth || !Object.hasOwn(auth,'value') || !Array.isArray(auth.value) ||
            auth.value.length!==1 || Object.getPrototypeOf(auth.value)!==Array.prototype) return invalid;
        const one=Object.getOwnPropertyDescriptor(auth.value,'0');
        if(!one || !Object.hasOwn(one,'value') || one.value!==header) return invalid;
      } else if(auth!==undefined) return invalid;
    }
    const raw=req?.rawHeaders;
    if(raw!==undefined) {
      if(!Array.isArray(raw) || Object.getPrototypeOf(raw)!==Array.prototype ||
          raw.length%2!==0 || raw.length>256) return invalid;
      let count=0;
      for(let i=0;i<raw.length;i+=2) {
        const k=Object.getOwnPropertyDescriptor(raw,String(i));
        const v=Object.getOwnPropertyDescriptor(raw,String(i+1));
        if(!k || !v || !Object.hasOwn(k,'value') || !Object.hasOwn(v,'value') ||
            typeof k.value!=='string' || typeof v.value!=='string') return invalid;
        if(k.value.toLowerCase()==='authorization') {
          count++;
          if(v.value!==header || count>1) return invalid;
        }
      }
      if((header===undefined && count!==0) || (header!==undefined && count!==1)) return invalid;
    }
    return {valid:true,value:header};
  } catch { return invalid; }
}

export function createMcpBearerAuthenticator({ getAccessToken, projectConnection, env = process.env }) {
  if (typeof getAccessToken !== 'function' || typeof projectConnection !== 'function') {
    throw new TypeError('A token lookup and server-owned connection policy are required');
  }
  return async function authenticate(req, res) {
    const challenge = 'Bearer resource_metadata="' +
      publicOrigin(env) + '/.well-known/oauth-protected-resource"';
    const evidence=authorizationHeaderEvidence(req);
    const match=evidence.valid && typeof evidence.value==='string'
      ? bearer.exec(evidence.value) : null;
    if (!match) {
      res.setHeader('WWW-Authenticate', challenge);
      send(res, 401, { error: 'unauthorized', error_description: 'A valid connection is required' });
      return null;
    }
    // The server owns durable expiry/revocation/lockout/account validation.
    let record;
    try { record = await getAccessToken(match[1]); }
    catch {
      // A storage outage is not an invalid or revoked credential. Fail closed
      // without revealing query details or pretending a token was revoked.
      send(res, 503, { error: 'temporarily_unavailable' });
      return null;
    }
    let projected = null;
    if (record) {
      try {
        const candidate=await projectConnection(record);
        projected=isolatedClaims(candidate,match[1]);
      } catch { projected = null; }
    }
    if (!projected) {
      res.setHeader('WWW-Authenticate', challenge + ', error="invalid_token"');
      send(res, 401, { error: 'invalid_token' });
      return null;
    }
    // Only deeply frozen, plain, explicitly projected claims cross this boundary.
    return projected;
  };
}
