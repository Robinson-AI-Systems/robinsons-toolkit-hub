import {formFields,htmlHeaders,publicHubOrigin,verifyOwnerLogin} from './owner-login.js';

const requiredTables=['hub_servers','hub_server_grants','hub_rtc_read_audit',
 'hub_rtc_result_handles'];
function configuredKey(value) {
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))return false;
 const decoded=Buffer.from(value,'base64url');
 return decoded.length===32&&decoded.toString('base64url')===value;
}
function intro() {
 return '<!doctype html><html lang="en"><meta charset="utf-8">'+
  '<title>Hub TEST federation readiness</title><main><h1>Hub H-3 TEST readiness</h1>'+
  '<p><a href="/api/owner/dashboard">Open private owner control center</a></p>'+ 
  '<p>Only the verified owner may see current setup state. No upstream test, '+
  'grant issuance, service activation or provider write runs on this page.</p>';
}
function form() {
 return intro()+'<form method="POST" action="/api/owner/readiness">'+
  '<label>Owner passphrase <input type="password" name="password" '+
  'autocomplete="current-password" required></label>'+
  '<button type="submit">Check private TEST readiness</button></form></main></html>';
}
export async function summarizeHubReadiness(db,ownerId,settings) {
 const result=await db.query(`SELECT table_name FROM information_schema.tables
   WHERE table_schema=current_schema() AND table_name=ANY($1::text[])`,
  [requiredTables]);
 const found=new Set(result.rows.map(r=>r.table_name));
 const schemaReady=requiredTables.every(x=>found.has(x));
 let counts={servers:0,grants:0,active:0,verified:0,ready_services:0};
 if(schemaReady){
  const {rows}=await db.query(`SELECT
   (SELECT count(*)::integer FROM hub_servers WHERE owner_id=$1) AS servers,
   (SELECT count(*)::integer FROM hub_server_grants WHERE owner_id=$1
     AND revoked_at IS NULL AND expires_at>now()) AS grants,
   (SELECT count(*)::integer FROM hub_servers WHERE owner_id=$1
     AND state='active') AS active,
   (SELECT count(*)::integer FROM hub_server_grants WHERE owner_id=$1
     AND revoked_at IS NULL AND expires_at>now()
     AND verified_at IS NOT NULL) AS verified,
   (SELECT count(DISTINCT g.server_name)::integer
     FROM hub_server_grants g JOIN hub_servers s
       ON s.name=g.server_name AND s.owner_id=g.owner_id
     WHERE g.owner_id=$1 AND s.state='active'
       AND g.revoked_at IS NULL AND g.expires_at>now()
       AND g.verified_at IS NOT NULL) AS ready_services`,[ownerId]);
  if(rows[0])counts=rows[0];
 }
 return {schemaReady,installedTables:found.size,
  grantsKeyReady:configuredKey(settings.grantsKey),
  resultsKeyReady:configuredKey(settings.resultsKey),
  servers:Number(counts.servers)||0,stagedGrants:Number(counts.grants)||0,
  activeServers:Number(counts.active)||0,verifiedGrants:Number(counts.verified)||0,
  readyServices:Number(counts.ready_services)||0};
}
function report(state) {
 const line=(label,value)=>'<li>'+label+': <strong>'+value+'</strong></li>';
 const yes=v=>v?'ready':'not ready';
 const scoped=state.schemaReady&&state.grantsKeyReady&&
  state.resultsKeyReady&&state.readyServices>=2;
 return intro()+'<p>Configuration snapshot only: no provider or transport '+
  'acceptance is claimed.</p><ul>'+
  line('Required H-2/H-3 database tables',state.installedTables+'/4')+
  line('Separate encrypted upstream grant key',yes(state.grantsKeyReady))+
  line('Sealed forwarded-result key',yes(state.resultsKeyReady))+
  line('Owner-staged RTC services',state.servers)+
  line('Unexpired scoped TEST grants',state.stagedGrants)+
  line('Activated RTC registry services',state.activeServers)+
  line('Verified TEST grants',state.verifiedGrants)+
  line('Distinct active TEST services with verified grants',state.readyServices)+
  '</ul><p>Two-service TEST routing preflight: '+yes(scoped)+
  '. A ready preflight still requires independently reviewed deployed '+
  'origins, authenticated harmless reads, denial/readback and revocation.</p>'+
  '</main></html>';
}
export async function handleOwnerReadiness(req,res,{withDb,env=process.env,
 verify=verifyOwnerLogin,summarize=summarizeHubReadiness}={}) {
 htmlHeaders(res);
 res.setHeader('Pragma','no-cache');
 if(!['GET','POST'].includes(req.method)) {
  res.setHeader('Allow','GET, POST');
  return res.status(405).send('Method not allowed');
 }
 try {publicHubOrigin(env);}
 catch{return res.status(503).send('Hub owner setup unavailable');}
 if(req.method==='GET')return res.status(200).send(form());
 if(!String(req.headers?.['content-type']||'').startsWith(
  'application/x-www-form-urlencoded'))
  return res.status(415).send('Unsupported content type');
 const fields=formFields(req);
 if(!fields||Object.keys(fields).length!==1||
  typeof fields.password!=='string'||!fields.password||
  fields.password.length>256)return res.status(400).send('Invalid request');
 try {
  return await withDb(async(db,settings)=>{
   const check=await verify(db,req,fields.password,{env});
   if(!check.approved){
    if(check.retryAfter)res.setHeader('Retry-After',String(check.retryAfter));
    return res.status(check.retryAfter?429:401).send('Owner verification denied');
   }
   const state=await summarize(db,env.HUB_OWNER_ID,settings);
   return res.status(200).send(report(state));
  });
 } catch{return res.status(503).send('Hub TEST readiness unavailable');}
}
