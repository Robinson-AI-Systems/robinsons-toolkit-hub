import {serverNamePattern} from './server-name.js';
import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {resolveActiveCallerGrant} from './grants.js';

const handlePattern=/^rtc_[A-Za-z0-9_-]{43}$/;
const grantPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const serverPattern=serverNamePattern;
const digest=(pepper,value)=>createHmac('sha256',pepper).update(value).digest('hex');
function validated(actor,settings) {
 if(!actor||!actor.ownerId||!actor.id||!['test','live'].includes(actor.mode)||!actor.areas?.includes('gateway'))
   throw Error('RTC result caller out of scope');
 const raw=settings?.resultsKey,pepper=settings?.pepper;
 if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw)||
   typeof pepper!=='string'||pepper.length<32)
   throw Error('RTC result encryption unavailable');
 const key=Buffer.from(raw,'base64url');
 if(key.length!==32||key.toString('base64url')!==raw)
   throw Error('RTC result encryption unavailable');
 return {key,pepper,caller:actor.ownerId+String.fromCharCode(0)+actor.id};
}
function aad(caller,grantId,service) {
 if(!grantPattern.test(grantId||'')||!serverPattern.test(service||''))
   throw TypeError('Invalid RTC grant binding');
 return Buffer.from([caller,grantId,service].join(String.fromCharCode(0)),'utf8');
}
// Expired encrypted result handles are no longer available to callers, but
// without bounded collection they consume the Hub's capped Neon storage forever.
// This touches only expired RTC handles, never H-1 results or active pages.
export async function pruneExpiredRtcResults(db,{limit=100}={}) {
 if(!Number.isInteger(limit)||limit<1||limit>100)
  throw new TypeError('Invalid RTC expiry collection bound');
 const {rowCount}=await db.query(`WITH expired AS (
   SELECT handle_digest FROM hub_rtc_result_handles
   WHERE expires_at<=now() ORDER BY expires_at,handle_digest LIMIT $1
  ) DELETE FROM hub_rtc_result_handles existing USING expired
   WHERE existing.handle_digest=expired.handle_digest`,[limit]);
 return rowCount;
}
export async function storeRtcResult(db,actor,grantId,service,result,settings) {
 const {key,pepper,caller}=validated(actor,settings);
 const associated=aad(caller,grantId,service);
 const value=JSON.stringify(result);
 if(typeof value!=='string')throw TypeError('Invalid RTC JSON');
 const plain=Buffer.from(value,'utf8');
 if(!plain.length||plain.length>65536)throw RangeError('RTC result exceeds storage bound');
 await pruneExpiredRtcResults(db);
 const handle='rtc_'+randomBytes(32).toString('base64url');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
 cipher.setAAD(associated);
 const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
 await db.query(`INSERT INTO hub_rtc_result_handles
  (handle_digest,owner_id,caller_digest,grant_id,server_name,ciphertext,nonce,tag,plain_bytes,expires_at)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '1 hour')`,
  [digest(pepper,handle),actor.ownerId,digest(pepper,caller),grantId,service,
   ciphertext,nonce,cipher.getAuthTag(),plain.length]);
 return {handle,bytes:plain.length,pages:Math.ceil(plain.length/4096),
  readTool:'hub_result_read'};
}
export async function readRtcResult(db,actor,handle,page,settings,
 {resolve=resolveActiveCallerGrant}={}) {
 const {key,pepper,caller}=validated(actor,settings);
 if(!handlePattern.test(handle||'')||!Number.isInteger(page)||page<0||page>15)
   return null;
 const {rows}=await db.query(`SELECT grant_id,server_name,ciphertext,nonce,tag,plain_bytes
   FROM hub_rtc_result_handles WHERE handle_digest=$1 AND owner_id=$2
   AND caller_digest=$3 AND expires_at>now()`,
   [digest(pepper,handle),actor.ownerId,digest(pepper,caller)]);
 const row=rows[0];
 if(!row)return null;
 const active=await resolve(db,{actor,serverName:row.server_name},settings);
 if(!active||active.grantId!==row.grant_id||active.server!==row.server_name)
   return null;
 const cipher=createDecipheriv('aes-256-gcm',key,row.nonce);
 cipher.setAAD(aad(caller,row.grant_id,row.server_name));
 cipher.setAuthTag(row.tag);
 const plain=Buffer.concat([cipher.update(row.ciphertext),cipher.final()]);
 if(plain.length!==row.plain_bytes||plain.length>65536)
   throw Error('RTC result integrity failure');
 const pages=Math.ceil(plain.length/4096);
 if(page>=pages)return null;
 return {encoding:'base64url',data:plain.subarray(page*4096,
  Math.min((page+1)*4096,plain.length)).toString('base64url'),
  page,pages,bytes:plain.length,next:page+1<pages?page+1:null};
}
