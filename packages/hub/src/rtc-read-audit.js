import {randomUUID} from 'node:crypto';
import {serverNamePattern} from './server-name.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toolName=/^[a-z][a-z0-9_]{2,119}$/;
const serverName=serverNamePattern;
export function newRtcCorrelation() {return randomUUID();}
export async function appendRtcReadAudit(db,{actor,grantId,service,tool,
  correlationId,phase,outcome,upstreamLogId=null}) {
  const kind=actor?.clientId?'oauth':'pass';
  if(!actor||typeof actor.ownerId!=='string'||!actor.ownerId||
    !uuid.test(actor.id||'')||!['test','live'].includes(actor.mode)||
    !['read_only','everyday','full'].includes(actor.profile)||
    (actor.allowWrites===true&&actor.profile==='read_only')||
    !Array.isArray(actor.areas)||!actor.areas.includes('gateway')||
    !uuid.test(grantId||'')||!serverName.test(service||'')||
    !toolName.test(tool||'')||!uuid.test(correlationId||'')||
    !['attempt','outcome'].includes(phase)||
    !['allowed','success','refused','unavailable'].includes(outcome)||
    (phase==='attempt'&&outcome!=='allowed')||
    (phase==='outcome'&&outcome==='allowed')||
    (upstreamLogId!==null&&(phase!=='outcome'||
      typeof upstreamLogId!=='string'||!upstreamLogId.length||
      upstreamLogId.length>128||!/^[a-zA-Z0-9:_./-]+$/.test(upstreamLogId))))
    throw new TypeError('Invalid scoped RTC forwarding audit');
  const values=[actor.ownerId,kind,actor.id,
    kind==='pass'?actor.id:null,kind==='oauth'?actor.id:null,
    grantId,service,tool,correlationId,phase,outcome,upstreamLogId];
  const {rows}=await db.query(`INSERT INTO hub_rtc_read_audit
   (owner_id,caller_kind,caller_id,pass_caller_id,oauth_session_id,
     grant_id,server_name,tool_name,correlation_id,phase,outcome,upstream_log_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,values);
  if(!rows[0]?.id)throw new Error('Missing durable RTC audit acknowledgement');
  return rows[0].id;
}
