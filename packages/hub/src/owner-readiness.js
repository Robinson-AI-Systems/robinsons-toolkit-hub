import {escapeHtml,formFields,htmlHeaders,publicHubOrigin,verifyOwnerLogin} from './owner-login.js';

const requiredTables=['hub_servers','hub_server_grants','hub_rtc_read_audit',
 'hub_rtc_result_handles'];
function configuredKey(value) {
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))return false;
 const decoded=Buffer.from(value,'base64url');
 return decoded.length===32&&decoded.toString('base64url')===value;
}
function intro() {
 return '<!doctype html><html lang="en"><meta charset="utf-8">'+
  '<title>Hub service connection readiness</title><main><h1>Hub service connection readiness</h1>'+
  '<p><a href="/api/owner/dashboard">Open private owner control center</a></p>'+ 
  '<p>Only the verified owner may see current setup state. No upstream test, '+
  'grant issuance, service activation or provider write runs on this page.</p>';
}
function form() {
 return intro()+'<form method="POST" action="/api/owner/readiness">'+
  '<label>Owner passphrase <input type="password" name="password" '+
  'autocomplete="current-password" required></label>'+
  '<button type="submit">Check private readiness</button></form></main></html>';
}
// Inspect metadata only. No migrations, token values or upstream requests.
// Exact validated definitions distinguish installed migrations from same-name drift.
const grantColumns=['owner_id','server_name','mode','revoked_at','expires_at','verified_at'];
const serverColumns=['name','owner_id','state'];
const checks={
 'hub_server_grants.hub_grant_selected_profile':
  "CHECK ((profile = ANY (ARRAY['read_only'::text, 'everyday'::text, 'full'::text])))",
 'hub_server_grants.hub_grant_selected_mode':
  "CHECK ((mode = ANY (ARRAY['test'::text, 'live'::text])))",
 'hub_oauth_codes.hub_oauth_code_write_profile':
  "CHECK (((NOT allow_writes) OR ((profile = ANY (ARRAY['everyday'::text, 'full'::text])) AND (allowed_servers IS NOT NULL))))",
 'hub_oauth_sessions.hub_oauth_session_write_profile':
  "CHECK (((NOT allow_writes) OR ((profile = ANY (ARRAY['everyday'::text, 'full'::text])) AND (allowed_servers IS NOT NULL))))"
};
const compact=value=>String(value).replace(/\s/g,'');
export async function summarizeHubReadiness(db,ownerId,settings) {
 const result=await db.query(`SELECT table_name FROM information_schema.tables
   WHERE table_schema=current_schema() AND table_name=ANY($1::text[])`,
  [requiredTables]);
 const found=new Set(result.rows.map(r=>r.table_name));
 const columns=await db.query(`SELECT table_name,column_name,data_type,is_nullable,
   column_default FROM information_schema.columns WHERE table_schema=current_schema()
   AND table_name=ANY($1::text[])`,
  [['hub_servers','hub_server_grants','hub_oauth_codes','hub_oauth_sessions']]);
 const has=(table,column)=>columns.rows.some(r=>r.table_name===table&&r.column_name===column);
 const schemaReady=requiredTables.every(x=>found.has(x))&&
  grantColumns.every(c=>has('hub_server_grants',c))&&
  serverColumns.every(c=>has('hub_servers',c));
 const constraints=await db.query(`SELECT t.relname AS table_name,c.conname,
   c.convalidated,pg_get_constraintdef(c.oid) AS definition
   FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
   JOIN pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname=current_schema() AND c.contype='c'
   AND c.conname=ANY($1::text[])`,[Object.keys(checks).map(k=>k.split('.')[1])]);
 const checkReady=key=>constraints.rows.some(r=>
  r.table_name+'.'+r.conname===key&&r.convalidated===true&&
  compact(r.definition)===compact(checks[key]));
 const liveGrantSchemaReady=schemaReady&&
  checkReady('hub_server_grants.hub_grant_selected_profile')&&
  checkReady('hub_server_grants.hub_grant_selected_mode');
 const oauthWriteSchemaReady=['hub_oauth_codes','hub_oauth_sessions'].every(table=>
  columns.rows.some(r=>r.table_name===table&&r.column_name==='allow_writes'&&
   r.data_type==='boolean'&&r.is_nullable==='NO'&&r.column_default==='false')&&
  checkReady(table+'.'+(table==='hub_oauth_codes'?
   'hub_oauth_code_write_profile':'hub_oauth_session_write_profile')));
 const modes=Object.fromEntries(['test','live'].map(mode=>[mode,{
  unexpiredGrants:0,verifiedGrants:0,registeredServices:0}]));
 let servers=0,activeServers=0;
 if(schemaReady){
  const {rows}=await db.query(`SELECT
   (SELECT count(*)::integer FROM hub_servers WHERE owner_id=$1) AS servers,
   (SELECT count(*)::integer FROM hub_servers WHERE owner_id=$1
     AND state='active') AS active`,[ownerId]);
  servers=Number(rows[0]?.servers)||0;activeServers=Number(rows[0]?.active)||0;
  const grants=await db.query(`SELECT g.mode,count(*)::integer AS grants,
   count(*) FILTER (WHERE g.verified_at IS NOT NULL)::integer AS verified,
   count(DISTINCT g.server_name) FILTER (WHERE g.verified_at IS NOT NULL
     AND s.state='active')::integer AS registered_services
   FROM hub_server_grants g LEFT JOIN hub_servers s
     ON s.name=g.server_name AND s.owner_id=g.owner_id
   WHERE g.owner_id=$1 AND g.revoked_at IS NULL AND g.expires_at>now()
   GROUP BY g.mode`,[ownerId]);
  for(const row of grants.rows)if(Object.hasOwn(modes,row.mode))
   modes[row.mode]={unexpiredGrants:Number(row.grants)||0,
    verifiedGrants:Number(row.verified)||0,registeredServices:Number(row.registered_services)||0};
 }
 return {schemaReady,installedTables:found.size,liveGrantSchemaReady,oauthWriteSchemaReady,
  grantsKeyReady:configuredKey(settings.grantsKey),
  resultsKeyReady:configuredKey(settings.resultsKey),servers,activeServers,modes,
  // Original summary consumers now receive TEST-only values as their labels promised.
  stagedGrants:modes.test.unexpiredGrants,verifiedGrants:modes.test.verifiedGrants,
  readyServices:modes.test.registeredServices};
}
export function renderReadinessSummary(state) {
 const line=(label,value)=>'<li>'+escapeHtml(label)+': <strong>'+escapeHtml(value)+'</strong></li>';
 const yes=v=>v?'ready':'not ready';
 const common=state.schemaReady&&state.grantsKeyReady&&state.resultsKeyReady;
 let body='<p>Configuration snapshot only. Current caller authorization, deployed '+
  'source, normal discovery/connection and actual provider reads are UNVERIFIED '+
  'regardless of counts below.</p><ul>'+
  line('Required H-2/H-3 database tables',state.installedTables+'/4')+
  line('Read-count tables and columns',yes(state.schemaReady))+
  line('Selected TEST/LIVE grant schema (023)',yes(state.liveGrantSchemaReady))+
  line('Optional OAuth write-delegation schema (024)',yes(state.oauthWriteSchemaReady))+
  line('Separate encrypted upstream grant key',yes(state.grantsKeyReady))+
  line('Sealed forwarded-result key',yes(state.resultsKeyReady))+
  line('Owner-staged RTC services',state.servers)+
  line('Activated RTC registry services',state.activeServers)+'</ul>';
 for(const mode of ['test','live']){
  const counts=state.schemaReady?state.modes?.[mode]:null;
  const name=mode.toUpperCase();
  body+='<h2>'+name+' configuration</h2><ul>'+
   line('Unexpired '+name+' grants',counts?.unexpiredGrants??'unavailable')+
   line('Verified '+name+' grants',counts?.verifiedGrants??'unavailable')+
   line('Distinct active registered '+name+' services with verified grants',
    counts?.registeredServices??'unavailable')+'</ul>';
  const configured=common&&counts?.registeredServices>=1&&
   (mode==='test'||state.liveGrantSchemaReady);
  body+='<p>'+name+' read configuration preflight: '+yes(configured)+'.</p>';
 }
 body+='<p>Two-service TEST routing preflight: '+
  yes(common&&state.modes?.test?.registeredServices>=2)+
  '. These are stored grant counts; expired or revoked callers can still have '+
  'unexpired grants. Every request must independently revalidate its exact caller '+
  'and provider grant. A ready preflight requires real normal-flow authorization, '+
  'harmless reads, denied boundaries and same-pass revocation before acceptance.</p>'+
  '<p>If schema is not ready, review the checked migrations through the approved '+
  'deployment process. This page never applies them. Optional OAuth write '+
  'delegation is unnecessary for read-only connections. '+
  '<a href="/api/owner/connect-service">Connect a service</a></p>';
 return body;
}
function report(state) {
 return intro()+renderReadinessSummary(state)+'</main></html>';
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
 } catch{return res.status(503).send('Hub readiness unavailable');}
}
