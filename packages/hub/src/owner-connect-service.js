// H-2 normal RTC onboarding: public discovery first, independently owned
// credential second. Uses original H-4 encryption, caller checks and activation.
import {discoverRtcService} from './pinned-contract.js';
import {validateStagedOrigin,stageHubServer} from './registry.js';
import {stageCallerGrant,activateVerifiedCallerGrant} from './grants.js';
import {inspectScopedRtcIdentity} from './pinned-identity.js';
import {listHubPassScopes} from './identity.js';
import {listOwnerOAuthFamilies} from './oauth.js';
import {limitedServiceProfile} from './service-profile-policy.js';
import {escapeHtml as esc,formFields,htmlHeaders,publicHubOrigin,verifyOwnerLogin} from './owner-login.js';
import {serverNamePattern} from './server-name.js';
const route='/api/owner/connect-service';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ownerPattern=/^[A-Za-z0-9:_-]{1,120}$/;
const passPattern=/^rtc_pass_[A-Za-z0-9_-]{43}$/;
const page=body=>'<!doctype html><html lang="en"><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>Connect a service</title><main><h1>Connect a service</h1>'+body+
 '<p><a href="/api/owner/dashboard">Hub control center</a></p></main>';
const hidden=(name,value)=>'<input type="hidden" name="'+name+'" value="'+esc(value)+'">';
const password='<label>Hub owner passphrase <input type="password" name="password" autocomplete="current-password" required maxlength="256"></label>';
function firstForm(){
 return page('<p>Enter a service’s canonical HTTPS origin. The Hub discovers its RTC identity and available permissions before you authorize a connection.</p>'+
  '<form method="POST" action="'+route+'">'+hidden('action','discover')+
  '<label>Service HTTPS origin <input type="url" name="origin" required maxlength="255" placeholder="https://service.your-domain.com"></label>'+
  password+'<button type="submit">Discover service</button></form>');
}
const options=values=>values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
function connectionForm(service,callers){
 return page('<h2>'+esc(service.server)+'</h2><p>Origin: '+esc(service.origin)+
  '. Tool prefix: '+esc(service.prefix)+'. Advertised tools: '+service.tools+
  '. Public metadata is not authorization or a verified deployment revision.</p>'+
  '<p>The service registry is prepared. A provider grant is required before tools are available.</p><p>Available areas: '+esc(service.areas.join(', '))+'.</p>'+
  (!callers.length?'<p>No current Hub connection is available. Connect an agent to the Hub with your chosen mode and service permissions, then discover this service again. No provider grant was created.</p>':
  '<form method="POST" action="'+route+'">'+hidden('action','connect')+
  hidden('origin',service.origin)+hidden('server',service.server)+hidden('prefix',service.prefix)+
  '<label>Hub connection <select name="caller" required>'+callers.map(c=>
   '<option value="'+c.kind+':'+esc(c.id)+'">'+esc(c.kind+' '+c.id+' — '+c.mode+' / '+c.profile)+'</option>').join('')+'</select></label>'+
  '<label>Service mode <select name="mode">'+options(service.modes)+'</select></label>'+
  '<label>Service profile <select name="profile">'+options(service.profiles)+'</select></label>'+
  '<label>Allowed service areas (comma separated) <input name="areas" maxlength="2048" required></label>'+
  '<p>Authorize the chosen permissions directly at this service. Enter its separately issued RTC pass below; the Hub cannot issue or broaden that authorization. It will encrypt the pass only for this selected Hub connection. Existing service grants are preserved; use grant renewal to replace one.</p>'+
  '<label>Service-issued RTC pass <input type="password" name="service_pass" autocomplete="off" required maxlength="52"></label>'+
  '<p>Everyday/full permits provider writes only if both original connections already authorize them. Review potential charges, production changes, irreversible effects and the provider’s own confirmations.</p>'+
  '<label>For everyday/full, type I_AUTHORIZE <input name="write_ack" autocomplete="off" maxlength="16"></label>'+
  password+'<button type="submit">Authorize this service connection</button></form>'));
}
export async function availableServiceCallers(db,ownerId,{ownerVerified=false}={}){
 if(ownerVerified!==true||!ownerPattern.test(ownerId||''))throw Error('Independent owner required');
 const passes=await listHubPassScopes(db,ownerId,{ownerVerified:true});
 const families=await listOwnerOAuthFamilies(db,ownerId,{ownerVerified:true});
 return [...passes.filter(p=>p.state==='current').map(p=>({...p,kind:'pass'})),
  ...families.filter(p=>Date.parse(p.accessExpiresAt)>Date.now()).map(p=>({...p,kind:'oauth'}))]
  .filter(p=>p.areas.includes('gateway')).slice(0,80);
}
function requestedScope(input){
 if(!input||!['test','live'].includes(input.mode)||
  !['read_only','everyday','full'].includes(input.profile)||
  !['pass','oauth'].includes(input.callerKind)||!uuid.test(input.callerId||'')||
  !serverNamePattern.test(input.server||'')||!/^[a-z][a-z0-9_]{1,59}$/.test(input.prefix||'')||
  !passPattern.test(input.pass||'')||!Array.isArray(input.areas)||input.areas.length<1||input.areas.length>32||
  new Set(input.areas).size!==input.areas.length||input.areas.some(a=>!(/^[a-z][a-z0-9_]{0,59}$/).test(a))||
  (input.profile!=='read_only'&&input.writeAck!=='I_AUTHORIZE'))throw Error('Invalid scoped service approval');
 validateStagedOrigin(input.origin);
}
export async function registerDiscoveredService(db,ownerId,service,{ownerVerified=false,stage=stageHubServer}={}){
 if(ownerVerified!==true||!ownerPattern.test(ownerId||''))throw Error('Independent owner required');
 const {server,prefix,origin}=service;
 validateStagedOrigin(origin);
 const existing=await db.query('SELECT origin,prefix,state FROM hub_servers WHERE name=$1 AND owner_id=$2',[server,ownerId]);
 if(existing.rows.length>1||existing.rows.length===1&&(
  existing.rows[0].origin!==origin||existing.rows[0].prefix!==prefix||
  !['pending','active'].includes(existing.rows[0].state)))throw Error('Registered service identity conflict');
 if(!existing.rows.length)await stage(db,{ownerId,name:server,prefix,origin,
  manifest:{rtc:1,server,prefix,modes:service.modes,profiles:service.profiles,
   counts:{tools:service.tools,writes:service.writes,money:service.money}}},{ownerVerified:true});
 return {state:existing.rows[0]?.state??'pending'};
}
export async function connectRtcService(db,settings,ownerId,input,{
 ownerVerified=false,discover=discoverRtcService,callers=availableServiceCallers,
 inspect=inspectScopedRtcIdentity,stage=stageHubServer,grant=stageCallerGrant,
 activate=activateVerifiedCallerGrant}={}){
 if(ownerVerified!==true||!ownerPattern.test(ownerId||''))throw Error('Independent owner required');
 requestedScope(input);
 const {origin,server,prefix,mode,profile,areas,callerKind,callerId,pass}=input;
 // Resolve the CURRENT exact caller before forwarding even a provider whoami.
 const current=(await callers(db,ownerId,{ownerVerified:true})).find(c=>c.kind===callerKind&&c.id===callerId);
 if(!current||current.mode!==mode||
   (current.serverNames!==null&&!current.serverNames.includes(server))||
   limitedServiceProfile(profile,current.profile,current.serviceProfiles,server)!==profile||
   (current.serviceAreas?.[server]&&areas.some(a=>!current.serviceAreas[server].includes(a))))
   throw Error('Selected Hub connection does not authorize this service scope');
 const checked=await discover(origin);
 if(checked.server!==server||checked.prefix!==prefix||
   !checked.modes.includes(mode)||!checked.profiles.includes(profile)||
   areas.some(a=>!checked.areas.includes(a)))throw Error('Discovered service identity or scope changed');
 const existing=await db.query('SELECT origin,prefix,state FROM hub_servers WHERE name=$1 AND owner_id=$2',[server,ownerId]);
 if(existing.rows.length>1||existing.rows.length===1&&(
  existing.rows[0].origin!==origin||existing.rows[0].prefix!==prefix||
  !['pending','active'].includes(existing.rows[0].state)))throw Error('Registered service identity conflict');
 // Never renew or replace an active/pending slot implicitly. Exact lifecycle
 // recovery stays in its existing independently approved renewal controls.
 const slots=await db.query(`SELECT id FROM hub_server_grants WHERE owner_id=$1
  AND server_name=$2 AND caller_kind=$3 AND (caller_id=$4 OR
   ($3='oauth' AND EXISTS (SELECT 1 FROM hub_oauth_sessions selected
    JOIN hub_oauth_sessions initial ON initial.family_id=selected.family_id
    WHERE selected.id=$4 AND initial.id=hub_server_grants.caller_id
     AND selected.owner_id=$1 AND initial.owner_id=$1)))
  AND revoked_at IS NULL LIMIT 1`,[ownerId,server,callerKind,callerId]);
 if(slots.rows.length)throw Error('Use existing grant renewal or staged-grant recovery');
 await inspect({origin,name:server,prefix,areas,pass,profile,mode});
 if(!existing.rows.length)await stage(db,{ownerId,name:server,prefix,origin,
  manifest:{rtc:1,server,prefix,modes:checked.modes,profiles:checked.profiles,
   counts:{tools:checked.tools,writes:checked.writes,money:checked.money}}},{ownerVerified:true});
 const staged=await grant(db,{ownerId,serverName:server,callerKind,callerId,
  areas,pass,profile,mode,ttlSeconds:mode==='live'?3600:86400},{ownerVerified:true,settings});
 const verified=await activate(db,{ownerId,id:staged.id},settings,{ownerVerified:true});
 if(verified?.state!=='verified_'+mode||verified.server!==server)throw Error('Service activation incomplete');
 return {server,mode,profile,areas:[...areas],state:'verified_'+mode,grantId:staged.id};
}
export async function handleOwnerConnectService(req,res,{withDb,env=process.env,
 verify=verifyOwnerLogin,discover=discoverRtcService,callers=availableServiceCallers,
 connect=connectRtcService,register=registerDiscoveredService}={}){
 htmlHeaders(res);res.setHeader('Pragma','no-cache');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).send('Method not allowed');}
 let origin;try{origin=publicHubOrigin(env);}catch{return res.status(503).send(page('<p>Hub setup unavailable.</p>'));}
 if(req.method==='GET')return res.status(200).send(firstForm());
 if(req.headers?.origin!==origin)return res.status(403).send('Same-origin approval required');
 if(!String(req.headers?.['content-type']||'').startsWith('application/x-www-form-urlencoded'))return res.status(415).send('Unsupported submission');
 const f=formFields(req),allowed=['action','password','origin','server','prefix','caller','mode','profile','areas','service_pass','write_ack'];
 if(!f||Object.keys(f).some(k=>!allowed.includes(k))||!['discover','connect'].includes(f.action)||
   typeof f.password!=='string'||!f.password||f.password.length>256)return res.status(400).send('Invalid connection request');
 let input;
 try{
  validateStagedOrigin(f.origin);
  if(f.action==='connect'){
   const [callerKind,callerId,...extra]=String(f.caller||'').split(':');
   if(extra.length)throw Error('Invalid caller');
   input={origin:f.origin,server:f.server,prefix:f.prefix,callerKind,callerId,
    mode:f.mode,profile:f.profile,areas:String(f.areas||'').split(',').map(a=>a.trim()),pass:f.service_pass,writeAck:f.write_ack};
   requestedScope(input);
  }else if(Object.keys(f).some(k=>!['action','password','origin'].includes(k)))throw Error('Invalid discovery fields');
 }catch{return res.status(400).send('Invalid service origin or scoped approval');}
 try{return await withDb(async(db,settings)=>{
  const decision=await verify(db,req,f.password,{env});
  if(!decision.approved){if(decision.retryAfter)res.setHeader('Retry-After',String(decision.retryAfter));return res.status(decision.retryAfter?429:401).send('Owner approval denied');}
  if(f.action==='discover'){
   const service=await discover(f.origin);
   await register(db,env.HUB_OWNER_ID,service,{ownerVerified:true});
   return res.status(200).send(connectionForm(service,await callers(db,env.HUB_OWNER_ID,{ownerVerified:true})));
  }
  const result=await connect(db,settings,env.HUB_OWNER_ID,input,{ownerVerified:true});
  return res.status(200).send(page('<h2>Service connection verified</h2><p>'+esc(result.server)+' — '+esc(result.mode)+' / '+esc(result.profile)+
   '; areas '+esc(result.areas.join(', '))+'. The original dispatcher will recheck caller, provider grant and tool permissions on every request. This setup did not execute a provider tool.</p>'));
 });}catch{return res.status(503).send(page('<p>Connection not completed. Check the registry and staged grants before retrying. Existing grants were not replaced. Never paste credentials into chat.</p>'));}
}
