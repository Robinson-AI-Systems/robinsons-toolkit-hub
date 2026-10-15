// H-5: immutable, caller-scoped, bounded view of H-3's real RTC attempt
// receipts. An absent outcome is PENDING, never rewritten as success.
// No provider credentials, arguments, return bodies or ciphertext are stored.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {listEligibleRtcTargets} from './grants.js';
const owner=/^[A-Za-z0-9:_-]{1,120}$/;
const server=/^[a-z][a-z0-9_]{1,59}$/;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const safeId=/^[1-9][0-9]{0,18}$/;
const reject=()=>{throw new TypeError('Invalid scoped Hub change history request');};
const urlbytes=value=>Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
function signingKey(settings){
 const pepper=settings?.pepper;
 if(typeof pepper!=='string'||Buffer.byteLength(pepper,'utf8')<32)reject();
 return pepper;
}
function sign(data,settings){
 return createHmac('sha256',signingKey(settings)).update(data).digest('base64url');
}
function parseScope(input,{ownerVerified=false}={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||!owner.test(input.ownerId||''))reject();
 const {actor=null,serverName=null,limit=10,cursor=null}=input;
 if(!Number.isInteger(limit)||limit<1||limit>20||
   (serverName!==null&&(!server.test(serverName)))||
   (cursor!==null&&(typeof cursor!=='string'||cursor.length>540)))reject();
 if(actor===null) {
   if(ownerVerified!==true)throw new Error('Independently verified owner required');
   return {ownerId:input.ownerId,kind:null,callerId:null,serverName,limit,cursor};
 }
 if(ownerVerified===true||actor.ownerId!==input.ownerId||
   !uuid.test(actor.id||'')||actor.mode!=='test'||actor.allowWrites===true||
   !Array.isArray(actor.areas)||!actor.areas.includes('gateway')||
   !['read_only','everyday','full'].includes(actor.profile))reject();
 const kind=actor.clientId?'oauth':'pass';
 return {ownerId:input.ownerId,kind,callerId:actor.id,serverName,limit,cursor};
}
function signatureScope(scope){
 return [scope.ownerId,scope.kind??'*',scope.callerId??'*',scope.serverName??'*'];
}
export function issueHubChangeCursor(scope,lastId,settings,{now=Date.now}={}){
 if(!safeId.test(String(lastId)))reject();
 const data={v:1,s:signatureScope(scope),i:String(lastId),
   exp:Math.floor(now()/1000)+300};
 const encoded=urlbytes(data);
 if(encoded.length>460)reject();
 return encoded+'.'+sign(encoded,settings);
}
export function readHubChangeCursor(value,scope,settings,{now=Date.now}={}){
 if(typeof value!=='string'||value.length>540||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value))reject();
 const [encoded,mac]=value.split('.');
 const expected=sign(encoded,settings);
 if(!timingSafeEqual(Buffer.from(mac,'utf8'),Buffer.from(expected,'utf8')))reject();
 let data;
 try{data=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));}
 catch{reject();}
 if(!data||data.v!==1||!safeId.test(data.i||'')||
   !Number.isSafeInteger(data.exp)||data.exp<=Math.floor(now()/1000)||
   data.exp>Math.floor(now()/1000)+300||
   JSON.stringify(data.s)!==JSON.stringify(signatureScope(scope)))reject();
 return data.i;
}
function project(row) {
 const outcome=['success','refused','unavailable'].includes(row.outcome)?
   row.outcome:'pending';
 const upstream=typeof row.upstream_log_id==='string'&&
   /^[A-Za-z0-9:_./-]{1,128}$/.test(row.upstream_log_id)?
   row.upstream_log_id:null;
 return {id:String(row.id),at:row.occurred_at,
   connection:row.caller_kind,callerId:row.caller_id,
   server:row.server_name,tool:row.tool_name,
   correlationId:row.correlation_id,
   outcome,summary:outcome==='pending'?'RTC read attempted; outcome not recorded':
     outcome==='success'?'RTC provider read reported success':
     outcome==='refused'?'RTC provider refused the requested read':
     'RTC provider read outcome unavailable; do not retry automatically',
   serverLogId:upstream,dryRun:false};
}
/**
 * All reads use the same PostgreSQL statement snapshot and a keyset, not
 * an offset that can repeat entries if new calls are inserted. Owner can
 * inspect all own caller rows only after a separate password-gated approval.
 * A caller sees ONLY its own rows while the persisted caller is still
 * valid. This never independently authorizes provider tools or old pages.
 */
export async function listHubRecentChanges(db,input,settings,opts={}){
 const scope=parseScope(input,opts);
 // A historic receipt never becomes a permanent metadata capability. Recheck
 // the caller's currently eligible independently verified grants, including
 // server/area/profile/family reductions and revocation, before every page.
 const permitted=scope.kind===null?null:
   (await (opts.eligible??listEligibleRtcTargets)(db,input.actor,{limit:100}))
     .map(target=>target.name);

 const until=scope.cursor===null?null:readHubChangeCursor(scope.cursor,scope,settings,opts);
 const query=`SELECT a.id::text,a.occurred_at,a.caller_kind,a.caller_id,
    a.server_name,a.tool_name,a.correlation_id,
    o.outcome,o.upstream_log_id
   FROM hub_rtc_read_audit a
   LEFT JOIN LATERAL (
     SELECT b.outcome,b.upstream_log_id FROM hub_rtc_read_audit b
     WHERE b.owner_id=a.owner_id AND b.caller_kind=a.caller_kind
       AND b.caller_id=a.caller_id AND b.correlation_id=a.correlation_id
       AND b.phase='outcome' AND b.id>a.id
     ORDER BY b.id DESC LIMIT 1
   ) o ON TRUE
   WHERE a.owner_id=$1 AND a.phase='attempt'
    AND ($2::text IS NULL OR (a.caller_kind=$2 AND a.caller_id=$3))
    AND ($4::text IS NULL OR a.server_name=$4)
    AND ($5::bigint IS NULL OR a.id<$5)
    AND ($7::text[] IS NULL OR a.server_name=ANY($7::text[]))
    AND ($2::text IS NULL OR
      (a.caller_kind='pass' AND EXISTS(
        SELECT 1 FROM hub_callers c WHERE c.id=$3 AND c.owner_id=$1
         AND c.revoked_at IS NULL AND c.expires_at>now()
         AND c.mode='test' AND c.allow_writes=FALSE
         AND 'gateway'=ANY(c.allowed_areas)))
      OR (a.caller_kind='oauth' AND EXISTS(
        SELECT 1 FROM hub_oauth_sessions s
        WHERE s.id=$3 AND s.owner_id=$1 AND s.revoked_at IS NULL
          AND s.refresh_expires_at>now() AND s.access_expires_at>now()
          AND s.mode='test' AND 'gateway'=ANY(s.areas))))
   ORDER BY a.id DESC LIMIT $6`;
 const values=[scope.ownerId,scope.kind,scope.callerId,scope.serverName,
   until,scope.limit+1,permitted];
 const {rows}=await db.query(query,values);
 const chosen=rows.slice(0,scope.limit);
 const next=rows.length>scope.limit&&chosen.length?
   issueHubChangeCursor(scope,chosen.at(-1).id,settings,opts):null;
 const result={changes:chosen.map(project),next,incomplete:false,
   count:chosen.length,source:'hub_durable_rtc_audit',
   externalProviderAcceptance:'unverified'};
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>7600)
   throw new Error('Hub change history exceeds bounded reply size');
 return result;
}
