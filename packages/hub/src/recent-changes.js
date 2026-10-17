import {serverNamePattern} from './server-name.js';
// H-5: immutable, caller-scoped, bounded view of H-3's real RTC attempt
// receipts. An absent outcome is PENDING, never rewritten as success.
// No provider credentials, arguments, return bodies or ciphertext are stored.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {listEligibleRtcTargets} from './grants.js';
const owner=/^[A-Za-z0-9:_-]{1,120}$/;
const server=serverNamePattern;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const safeId=/^[1-9][0-9]{0,18}$/;
const reject=()=>{throw new TypeError('Invalid scoped Hub change history request');};
const urlbytes=value=>Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
const tool=/^[a-z][a-z0-9_]{2,119}$/;
const day=/^\\d{4}-\\d{2}-\\d{2}$/;
const utc=/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/;
function normalizeUtc(value,end=false) {
 if(value===null||value===undefined)return null;
 if(typeof value!=='string'||value.length>24||(!day.test(value)&&!utc.test(value)))reject();
 if(day.test(value)) {
   const date=new Date(value+'T00:00:00.000Z');
   if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)reject();
   if(end)date.setUTCHours(23,59,59,999);
   return date.toISOString();
 }
 const date=new Date(value);
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,19)!==value.slice(0,19))
   reject();
 return date.toISOString();
}
function signingKey(settings){
 const pepper=settings?.pepper;
 if(typeof pepper!=='string'||Buffer.byteLength(pepper,'utf8')<32)reject();
 return pepper;
}
function sign(data,settings){
 return createHmac('sha256',signingKey(settings)).update(data).digest('base64url');
}
function parseScope(input,{ownerVerified=false,now=Date.now}={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||!owner.test(input.ownerId||''))reject();
 const {actor=null,serverName=null,toolName=null,
   since=null,until=null,limit=10,cursor=null}=input;
 if(!Number.isInteger(limit)||limit<1||limit>20||
   (serverName!==null&&(!server.test(serverName)))||
   (cursor!==null&&(typeof cursor!=='string'||cursor.length>540))||
   (toolName!==null&&(!tool.test(toolName))))reject();
 const lower=normalizeUtc(since),upper=normalizeUtc(until,true);
 const nowMs=now();
 if(!Number.isFinite(nowMs)||(lower!==null&&Date.parse(lower)>nowMs)||
   (upper!==null&&Date.parse(upper)>nowMs &&
     !(day.test(until)&&until===new Date(nowMs).toISOString().slice(0,10)))||
   (lower!==null&&upper!==null&&lower>upper))reject();
 const filters={serverName,toolName,since:lower,until:upper,limit,cursor};
 if(actor===null) {
   if(ownerVerified!==true)throw new Error('Independently verified owner required');
   return {ownerId:input.ownerId,kind:null,callerId:null,...filters};
 }
 if(ownerVerified===true||actor.ownerId!==input.ownerId||
   !uuid.test(actor.id||'')||actor.mode!=='test'||actor.allowWrites===true||
   !Array.isArray(actor.areas)||!actor.areas.includes('gateway')||
   !['read_only','everyday','full'].includes(actor.profile))reject();
 const kind=actor.clientId?'oauth':'pass';
 return {ownerId:input.ownerId,kind,callerId:actor.id,...filters};
}
function signatureScope(scope){
 return [scope.ownerId,scope.kind??'*',scope.callerId??'*',
   scope.serverName??'*',scope.toolName??'*',scope.since??'*',
   scope.until??'*',scope.grantFingerprint??'*'];
}
export function issueHubChangeCursor(scope,lastId,settings,{now=Date.now}={}){
 if(!safeId.test(String(lastId)))reject();
 const scopeHash=createHash('sha256').update(JSON.stringify(signatureScope(scope)))
   .digest('base64url');
 const data={v:2,s:scopeHash,i:String(lastId),
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
 if(!data||data.v!==2||!safeId.test(data.i||'')||
   !Number.isSafeInteger(data.exp)||data.exp<=Math.floor(now()/1000)||
   data.exp>Math.floor(now()/1000)+300||
   data.s!==createHash('sha256').update(JSON.stringify(signatureScope(scope)))
     .digest('base64url'))reject();
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
     .map(target=>target.grantId)
     .filter(id=>typeof id==='string'&&uuid.test(id))
     .sort();
 // A signed cursor must not survive independent service-grant replacement.
 // Hash, never embed raw grant identifiers in the caller-visible cursor.
 if(permitted!==null)
   scope.grantFingerprint=createHash('sha256').update(JSON.stringify(permitted))
     .digest('base64url');
 const untilId=scope.cursor===null?null:readHubChangeCursor(scope.cursor,scope,settings,opts);
 const query=`SELECT a.id::text,a.occurred_at,a.caller_kind,a.caller_id,
    a.server_name,a.tool_name,a.correlation_id,
    a.outcome,a.upstream_log_id
   FROM hub_change_log a
   WHERE a.owner_id=$1
    AND ($2::text IS NULL OR (a.caller_kind=$2 AND a.caller_id=$3))
    AND ($4::text IS NULL OR a.server_name=$4)
    AND ($5::bigint IS NULL OR a.id<$5)
    AND ($7::uuid[] IS NULL OR (a.grant_id=ANY($7::uuid[])
      AND EXISTS(SELECT 1 FROM hub_server_grants g
        JOIN hub_servers s ON s.owner_id=g.owner_id AND s.name=g.server_name
        WHERE g.id=a.grant_id AND g.owner_id=a.owner_id
          AND g.caller_kind=a.caller_kind AND g.caller_id=a.caller_id
          AND g.server_name=a.server_name AND g.revoked_at IS NULL
          AND g.verified_at IS NOT NULL AND g.expires_at>now()
          AND g.mode='test' AND g.profile='read_only' AND s.state='active')))
    AND ($8::text IS NULL OR a.tool_name=$8)
    AND ($9::timestamptz IS NULL OR a.occurred_at>=$9)
    AND ($10::timestamptz IS NULL OR a.occurred_at<=$10)
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
   untilId,scope.limit+1,permitted,scope.toolName,scope.since,scope.until];
 const {rows}=await db.query(query,values);
 let length=Math.min(rows.length,scope.limit);
 // Do not fail an ordinary bounded history page merely because 20 long
 // metadata records exceed one 8-KiB MCP response. Return a real next cursor.
 for(;length>=0;length--){
   const chosen=rows.slice(0,length);
   const next=rows.length>length&&length>0?
     issueHubChangeCursor(scope,chosen.at(-1).id,settings,opts):null;
   const result={changes:chosen.map(project),next,incomplete:false,
     count:chosen.length,source:'hub_durable_rtc_audit',
     externalProviderAcceptance:'unverified'};
   if(Buffer.byteLength(JSON.stringify(result),'utf8')<=7600)return result;
 }
 throw new Error('Hub change history exceeds bounded reply size');
}
