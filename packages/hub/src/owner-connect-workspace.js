// Owner-first, one-page onboarding for the independently operated Workspace RTC.
// Server IDs, service areas, caller UUIDs and grant activation are Hub internals.
// The owner still supplies a service-issued read-only TEST credential once;
// Hub owner authentication can never mint Google Workspace authorization.
import {htmlHeaders,publicHubOrigin,formFields,verifyOwnerLogin,escapeHtml} from './owner-login.js';
import {probeStagedRtcContract,pinnedRtcJsonGet} from './pinned-contract.js';
import {stageHubServer} from './registry.js';
import {stageCallerGrant,activateVerifiedCallerGrant} from './grants.js';
import {cancelStagedGrant} from './grant-lifecycle.js';

const service='google-workspace-mcp',prefix='workspace';
const origin='https://google-workspace-mcp-chris-projects-de6cd1bf.vercel.app';
const areas=['mail','files','calendar','tasks','chat','admin','workspace','workflows',
 'dns','people','business','identity','datatransfer','licensing'];
const validPass=/^rtc_pass_[A-Za-z0-9_-]{43}$/;
const page=(body)=>'<!doctype html><html lang="en"><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>Connect Google Workspace</title><main><h1>Connect Google Workspace</h1>'+
 '<p>One Hub approval. Read-only TEST access only. No production activation or writes.</p>'+
 body+'</main>';
const form=()=>page('<form method="POST" action="/api/owner/connect-workspace">'+
 '<label>Hub owner passphrase <input type="password" name="password" '+
 'autocomplete="current-password" required maxlength="256"></label>'+
 '<label>Workspace read-only TEST pass (only needed the first time) '+
 '<input type="password" name="service_pass" autocomplete="off" maxlength="52"></label>'+
 '<p>If your Workspace MCP has not issued a read-only TEST pass yet, leave that '+
 'second box empty. The Hub can prepare registration but cannot impersonate '+
 'Workspace or issue its credentials.</p>'+
 '<button type="submit">Approve Workspace connection</button></form>');
const msg=(detail)=>page('<p>'+escapeHtml(detail)+'</p>'+
 '<p><a href="/api/owner/connect-workspace">Return to connection setup</a></p>');
function providerAreas(who) {
 if(!who||who.profile!=='read_only'||who.mode!=='test'||
  who.allowWrites===true||who.allow_writes===true||
  !(who.areas===null||Array.isArray(who.areas)))throw Error('Not a read-only TEST pass');
 const selected=who.areas===null?areas:who.areas;
 if(!selected.length||selected.length>areas.length||
  selected.some(a=>!areas.includes(a))||new Set(selected).size!==selected.length)
  throw Error('No safe RTC areas');
 return [...selected];
}
export async function connectWorkspace(db,settings,ownerId,servicePass,{
 probe=probeStagedRtcContract,stage=stageHubServer,read=pinnedRtcJsonGet,
 grant=stageCallerGrant,activate=activateVerifiedCallerGrant}={}){
 // Public RTC identity is checked with independent DNS/TLS pinning before
 // any staging. It is never an owner-supplied arbitrary URL or alias.
 const checked=await probe(origin,{name:service,prefix});
 const existing=await db.query('SELECT origin,prefix,state FROM hub_servers WHERE name=$1 AND owner_id=$2',
  [service,ownerId]);
 if(existing.rows.length>1)throw Error('Duplicate registered services');
 if(existing.rows.length===1){
  const saved=existing.rows[0];
  if(saved.origin!==origin||saved.prefix!==prefix||
   !['pending','active'].includes(saved.state))
   throw Error('Existing service identity unavailable');
 }else{
  await stage(db,{ownerId,name:service,prefix,origin,manifest:{
   rtc:1,server:service,prefix,modes:['test'],profiles:['read_only'],
   counts:{tools:checked.tools,writes:checked.writes,money:checked.money}
  }},{ownerVerified:true});
 }
 if(!servicePass) return {state:existing.rows[0]?.state==='active'?'registered':'prepared'};
 if(!validPass.test(servicePass))throw Error('Invalid Workspace credential');
 // Service-owned non-writing pass; null means all provider RTC areas,
 // unlike undefined (malformed identity), and is narrowed by our explicit
 // Hub grant area list. The provider's whoami MUST be verified over pinned TLS.
 const result=await read(origin,'/api/whoami',{pass:servicePass});
 if(result?.ok!==true)throw Error('Independent Workspace authorization refused');
 const selected=providerAreas(result.result);
 // Select ONE unrevoked latest OAuth generation per approved family.
 // A current access session takes priority. If none is current, a single
 // renewable family may be staged, but it cannot actually route until its
 // original approved client refreshes. Two families never grant implicitly.
 const connections=await db.query(`WITH candidates AS (
    SELECT DISTINCT ON (s.family_id) s.id,s.access_expires_at
    FROM hub_oauth_sessions s
    WHERE s.owner_id=$1 AND s.mode='test'
      AND s.profile IN ('read_only','everyday','full')
      AND s.revoked_at IS NULL AND s.refresh_expires_at>now()
      AND s.refresh_used_at IS NULL AND 'gateway'=ANY(s.areas)
      AND NOT EXISTS (SELECT 1 FROM hub_oauth_sessions gone
        WHERE gone.family_id=s.family_id AND gone.revoked_at IS NOT NULL)
      AND (NULLIF(to_jsonb(s)->'allowed_servers','null'::jsonb) IS NULL
        OR to_jsonb(s)->'allowed_servers' ? $2)
      AND COALESCE(to_jsonb(s)->'service_profile_policy'->>$2,'read_only')<>'disabled'
    ORDER BY s.family_id,s.access_expires_at DESC
  )
  SELECT id FROM candidates
  WHERE access_expires_at>now()
    OR NOT EXISTS (SELECT 1 FROM candidates WHERE access_expires_at>now())
  ORDER BY access_expires_at DESC LIMIT 2`,[ownerId,service]);
 if(connections.rows.length!==1)
  return {state:'needs_one_hub_connection'};
 // A real upstream timeout after staging leaves ONE noncallable pending grant
 // occupying this caller's unique slot. Only a new independently verified owner
 // approval PLUS successful service pass whoami may replace that unfinished
 // attempt; never touch a verified working grant or widen an existing scope.
 const pending=await db.query(`SELECT id FROM hub_server_grants
   WHERE owner_id=$1 AND server_name=$2 AND caller_kind='oauth' AND caller_id=$3
     AND verified_at IS NULL AND revoked_at IS NULL
   ORDER BY created_at DESC LIMIT 2`,[ownerId,service,connections.rows[0].id]);
 if(pending.rows.length>1)throw Error('Ambiguous unverified Workspace grant');
 if(pending.rows.length===1){
  const canceled=await cancelStagedGrant(db,{ownerId,id:pending.rows[0].id},
    {ownerVerified:true});
  if(!canceled)throw Error('Pending Workspace grant changed during owner recovery');
 }
 // Stage only for the ONE unambiguous existing caller; never grant
 // provider authority to arbitrary developer sessions.
 const staged=await grant(db,{ownerId,serverName:service,callerKind:'oauth',
  callerId:connections.rows[0].id,areas:selected,pass:servicePass,
  ttlSeconds:86400},{ownerVerified:true,settings});
 const verified=await activate(db,{ownerId,id:staged.id},settings,{ownerVerified:true});
 if(verified?.state!=='verified_test')throw Error('Workspace identity not activated');
 return {state:'verified_test'};
}
export async function handleOwnerConnectWorkspace(req,res,{withDb,env=process.env,
 verify=verifyOwnerLogin,connect=connectWorkspace}={}){
 htmlHeaders(res);
 res.setHeader('Pragma','no-cache');
 if(!['GET','POST'].includes(req.method))return res.status(405).send('Method not allowed');
 try{publicHubOrigin(env);}catch{return res.status(503).send(msg('Hub owner setup is unavailable.'));}
 if(req.method==='GET')return res.status(200).send(form());
 if(!String(req.headers?.['content-type']||'').startsWith('application/x-www-form-urlencoded'))
  return res.status(415).send(msg('Unsupported submission.'));
 const fields=formFields(req);
 if(!fields||Object.keys(fields).some(k=>!['password','service_pass'].includes(k))||
  typeof fields.password!=='string'||!fields.password||fields.password.length>256||
  fields.service_pass!==undefined&&fields.service_pass!==''&&!validPass.test(fields.service_pass))
  return res.status(400).send(msg('Enter your passphrase and, if available, a valid Workspace TEST pass.'));
 try{
  return await withDb(async(db,settings)=>{
   const authenticated=await verify(db,req,fields.password,{env});
   if(!authenticated.approved){
    if(authenticated.retryAfter)res.setHeader('Retry-After',String(authenticated.retryAfter));
    return res.status(authenticated.retryAfter?429:401).send(msg('Owner approval was not accepted.'));
   }
   const state=await connect(db,settings,env.HUB_OWNER_ID,fields.service_pass||null);
   const messages={
    prepared:'Workspace registration prepared. It is not connected until Workspace issues its separate read-only TEST authorization.',
    registered:'Workspace registration exists. A verified service grant is still required for this Hub connection.',
    needs_one_hub_connection:'Workspace is registered. Connect exactly one Hub TEST developer session, then approve again to bind a Workspace pass safely.',
    verified_test:'Workspace was verified and connected to your eligible Hub TEST session. No write or LIVE access was enabled.'
   };
   return res.status(state.state==='verified_test'?200:202).send(msg(messages[state.state]||'Workspace setup awaits independent authorization.'));
  });
 }catch{return res.status(503).send(msg('Workspace connection was not completed. Existing authorization remains unchanged. Retry only after checking setup status.'));}
}
