import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

// Provider pagination tokens are opaque upstream data. Never reveal the raw
// cursor to a Hub caller: seal it, bind it to the exact caller/grant/endpoint
// roster and expire it before it can outlive a short-lived TEST authorization.
const upstreamToken=/^[A-Za-z0-9_.~-]{1,128}$/;
const wrappedToken=/^p\.([A-Za-z0-9_-]{40,382})$/;
function key(settings) {
  if(typeof settings?.pepper!=='string'||settings.pepper.length<32)
    throw new Error('Hub provider cursor sealing unavailable');
  return createHash('sha256').update('hub-rtc-provider-cursor-v1\0')
    .update(settings.pepper).digest();
}
const scopeBytes=scope=>Buffer.from(JSON.stringify(scope),'utf8');

export function issueProviderCursor(scope,upstream,settings,{now=Date.now}={}) {
  if(typeof upstream!=='string'||!upstreamToken.test(upstream))
    throw new TypeError('Unsafe upstream continuation');
  const nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key(settings),nonce);
  cipher.setAAD(scopeBytes(scope));
  const payload=Buffer.from(JSON.stringify({v:1,e:Math.floor(now()/1000)+300,c:upstream}));
  const encrypted=Buffer.concat([cipher.update(payload),cipher.final()]);
  const token='p.'+Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64url');
  if(token.length>384)throw new TypeError('Upstream continuation exceeds safe bound');
  return token;
}

export function openProviderCursor(value,scope,settings,{now=Date.now}={}) {
  if(typeof value!=='string'||value.length>384)return null;
  const match=wrappedToken.exec(value);
  if(!match)return null;
  try {
    const data=Buffer.from(match[1],'base64url');
    if(data.toString('base64url')!==match[1]||data.length<40)return null;
    const decipher=createDecipheriv('aes-256-gcm',key(settings),data.subarray(0,12));
    decipher.setAAD(scopeBytes(scope));
    decipher.setAuthTag(data.subarray(12,28));
    const decoded=Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]);
    if(decoded.length>256)return null;
    const fields=JSON.parse(decoded.toString('utf8'));
    const seconds=Math.floor(now()/1000);
    if(!fields||Object.keys(fields).sort().join(',')!=='c,e,v'||
      fields.v!==1||!Number.isInteger(fields.e)||
      fields.e<=seconds||fields.e>seconds+300||
      typeof fields.c!=='string'||!upstreamToken.test(fields.c))return null;
    return fields.c;
  } catch{return null;}
}
