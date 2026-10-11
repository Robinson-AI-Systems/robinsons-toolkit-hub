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
