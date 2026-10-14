import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

// RTC1 servers in the independently observed fleet return structurally
// different continuation forms: integer offsets, decimal page strings, or
// opaque cursors. Preserve the observed style, never guess by service name.
const opaque=/^[A-Za-z0-9_.~-]{1,128}$/;
const decimal=/^[1-9][0-9]{0,5}$/;
const wrapped=/^p\.([A-Za-z0-9_-]{40,382})$/;
export function validProviderPage(next) {
 if(!next||typeof next!=='object'||Array.isArray(next)||
   Object.keys(next).sort().join(',')!=='kind,value')return false;
 if(next.kind==='cursor')return typeof next.value==='string'&&opaque.test(next.value);
 if(!['page','offset'].includes(next.kind)||typeof next.value!=='string'||
   !decimal.test(next.value))return false;
 const value=Number(next.value);
 return Number.isSafeInteger(value)&&value>=1&&value<=100000;
}
function key(settings) {
 if(typeof settings?.pepper!=='string'||settings.pepper.length<32)
  throw new Error('Hub provider cursor sealing unavailable');
 return createHash('sha256').update('hub-rtc-provider-cursor-v1\0')
  .update(settings.pepper).digest();
}
const scopeBytes=scope=>Buffer.from(JSON.stringify(scope),'utf8');

export function issueProviderCursor(scope,upstream,settings,{now=Date.now}={}) {
 if(!validProviderPage(upstream))throw new TypeError('Unsafe upstream continuation');
 const nonce=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',key(settings),nonce);
 cipher.setAAD(scopeBytes(scope));
 const payload=Buffer.from(JSON.stringify({v:1,e:Math.floor(now()/1000)+300,
  k:upstream.kind,c:upstream.value}));
 const encrypted=Buffer.concat([cipher.update(payload),cipher.final()]);
 const token='p.'+Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64url');
 if(token.length>384)throw new TypeError('Upstream continuation exceeds safe bound');
 return token;
}

export function openProviderCursor(value,scope,settings,{now=Date.now}={}) {
 if(typeof value!=='string'||value.length>384)return null;
 const match=wrapped.exec(value);
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
  if(!fields||Object.keys(fields).sort().join(',')!=='c,e,k,v'||
    fields.v!==1||!Number.isInteger(fields.e)||
    fields.e<=seconds||fields.e>seconds+300||
    !validProviderPage({kind:fields.k,value:fields.c}))return null;
  return {kind:fields.k,value:fields.c};
 } catch{return null;}
}
