import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {issueHubPass} from '../../src/identity.js';
import {stageCallerGrant,activateVerifiedCallerGrant,
 listEligibleRtcTargets} from '../../src/grants.js';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,authenticateOAuth}
 from '../../src/oauth.js';
import {appendRtcReadAudit,newRtcCorrelation} from '../../src/rtc-read-audit.js';
const settings={grantsKey:randomBytes(32).toString('base64url')};
const pass='rtc_pass_'+randomBytes(32).toString('base64url');
const pepper='synthetic-audit-postgresql-32-character-pepper';
let db,schema,actor,grantId;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('Local PostgreSQL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();
 schema='hub_rtc_audit_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const file of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
  '008-hub-rtc-audit.sql','020-hub-service-identities.sql'])
  await db.query(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 const issued=await issueHubPass(db,{ownerId:'owner-a',profile:'full',
  mode:'test',allowWrites:false,areas:['gateway'],ttlSeconds:3600},
  {pepper,ownerVerified:true});
 actor={id:issued.id,ownerId:'owner-a',mode:'test',profile:'full',
  allowWrites:false,areas:['gateway']};
 await db.query(`INSERT INTO hub_servers
  (name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
  VALUES('stripe','owner-a','stripe','https://stripe-mcp-psi.vercel.app',
    1,'{"tools":1,"writes":0,"money":0}')`);
 const staged=await stageCallerGrant(db,{ownerId:'owner-a',serverName:'stripe',
  callerKind:'pass',callerId:actor.id,pass,areas:['billing'],ttlSeconds:3600},
  {ownerVerified:true,settings});
 grantId=staged.id;
 await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:grantId},settings,
  {ownerVerified:true,inspect:async({name,prefix,areas})=>({
   identityVerified:true,callable:false,server:name,prefix,areas,
   profile:'read_only',mode:'test'})});
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');
 await db.end();}});
it('persists separate durable attempt and outcome without pass bytes or arguments',async()=>{
 const correlationId=newRtcCorrelation();
 const common={actor,grantId,service:'stripe',
  tool:'stripe_invoice_list',correlationId};
 const first=await appendRtcReadAudit(db,{...common,phase:'attempt',outcome:'allowed'});
 const last=await appendRtcReadAudit(db,{...common,phase:'outcome',
  outcome:'success',upstreamLogId:'log5'});
 expect(BigInt(last)).toBeGreaterThan(BigInt(first));
 const q=await db.query('SELECT * FROM hub_rtc_read_audit WHERE correlation_id=$1',
  [correlationId]);
 expect(q.rows.map(x=>x.phase)).toEqual(['attempt','outcome']);
 expect(q.rows[1]).toMatchObject({outcome:'success',upstream_log_id:'log5',
  pass_caller_id:actor.id,oauth_session_id:null,grant_id:grantId});
 expect(JSON.stringify(q.rows)).not.toContain(pass);
});
it('records authenticated OAuth session with its own foreign key',async()=>{
 const clientId='audit-oauth-client';
 const redirectUri='https://agent.example.com/cb';
 const verifier='pkce-assertion-0123456789abcdefghijklmnopqrstuv';
 const challenge=createHash('sha256').update(verifier).digest('base64url');
 await registerOAuthClient(db,{ownerId:'owner-a',clientId,redirectUri},
  {ownerVerified:true});
 const code=await issueOAuthCode(db,{ownerId:'owner-a',clientId,redirectUri,
  challenge,profile:'full',mode:'test',areas:['gateway']},{pepper,ownerVerified:true});
 const tokens=await exchangeOAuthCode(db,{clientId,redirectUri,
  code,verifier},{pepper});
 const oauthActor=await authenticateOAuth(db,tokens.access_token,{pepper});
 await db.query(`INSERT INTO hub_servers
 (name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
 VALUES('google','owner-a','google','https://google-workspace-mcp.vercel.app',
 1,'{"tools":2,"writes":0,"money":0}')`);
 const staged=await stageCallerGrant(db,{ownerId:'owner-a',serverName:'google',
  callerKind:'oauth',callerId:oauthActor.id,pass,areas:['gmail'],ttlSeconds:3600},
  {ownerVerified:true,settings});
 const correlationId=newRtcCorrelation();
 await appendRtcReadAudit(db,{actor:oauthActor,grantId:staged.id,
  service:'google',tool:'google_gmail_list',correlationId,
  phase:'attempt',outcome:'allowed'});
 const q=await db.query('SELECT * FROM hub_rtc_read_audit WHERE correlation_id=$1',
  [correlationId]);
 expect(q.rows[0]).toMatchObject({caller_kind:'oauth',
  oauth_session_id:oauthActor.id,pass_caller_id:null});
});
it('rejects impersonated actor and invalid unverified metadata before SQL insertion',async()=>{
 const before=await db.query('SELECT count(*)::integer AS n FROM hub_rtc_read_audit');
 await expect(appendRtcReadAudit(db,{actor:{...actor,mode:'live'},
   grantId,service:'stripe',tool:'stripe_invoice_list',
   correlationId:newRtcCorrelation(),phase:'attempt',outcome:'allowed'}))
  .rejects.toThrow();
 await expect(appendRtcReadAudit(db,{actor,grantId,service:'stripe',
   tool:'stripe_invoice_list',correlationId:newRtcCorrelation(),
   phase:'attempt',outcome:'success'})).rejects.toThrow();
 const after=await db.query('SELECT count(*)::integer AS n FROM hub_rtc_read_audit');
 expect(after.rows[0].n).toBe(before.rows[0].n);
});

it('returns private grant identity and verified origin only to the cursor scope selector',async()=>{
 const targets=await listEligibleRtcTargets(db,actor,{limit:100});
 const stripe=targets.find(t=>t.name==='stripe');
 expect(stripe).toMatchObject({grantId,origin:'https://stripe-mcp-psi.vercel.app',
  prefix:'stripe',state:'active',readOnlyGrant:true});
 expect(typeof stripe.verifiedAt).toBe('string');
 expect(stripe.verifiedAt.length).toBeGreaterThan(10);
 expect(JSON.stringify(targets)).not.toContain(pass);
});

it('audits official hyphenated Workspace RTC identity, including real OAuth and no bearer disclosure',async()=>{
 const clientId='audit-workspace-hyphen-client';
 const redirectUri='https://agent.example.com/rtc-callback';
 const verifier='pkce-workspace-0123456789abcdefghijklmnopqrstuv';
 const challenge=createHash('sha256').update(verifier).digest('base64url');
 await registerOAuthClient(db,{ownerId:'owner-a',clientId,redirectUri},{ownerVerified:true});
 const code=await issueOAuthCode(db,{ownerId:'owner-a',clientId,redirectUri,
  challenge,profile:'read_only',mode:'test',areas:['gateway']},{pepper,ownerVerified:true});
 const token=await exchangeOAuthCode(db,{clientId,redirectUri,code,verifier},{pepper});
 const oauthActor=await authenticateOAuth(db,token.access_token,{pepper});
 await db.query(`INSERT INTO hub_servers
  (name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
  VALUES('google-workspace-mcp','owner-a','workspace',
   'https://google-workspace-mcp-chris-projects-de6cd1bf.vercel.app',
   1,'{"tools":382,"writes":212,"money":0}')`);
 const staged=await stageCallerGrant(db,{ownerId:'owner-a',serverName:'google-workspace-mcp',
  callerKind:'oauth',callerId:oauthActor.id,pass,areas:['workspace'],ttlSeconds:3600},
  {ownerVerified:true,settings});
 const correlationId=newRtcCorrelation();
 const common={actor:oauthActor,grantId:staged.id,service:'google-workspace-mcp',
  tool:'workspace_whoami',correlationId};
 const first=await appendRtcReadAudit(db,{...common,phase:'attempt',outcome:'allowed'});
 const second=await appendRtcReadAudit(db,{...common,phase:'outcome',outcome:'success'});
 expect(BigInt(second)).toBeGreaterThan(BigInt(first));
 const events=(await db.query('SELECT server_name,tool_name,phase,caller_kind,oauth_session_id,grant_id FROM hub_rtc_read_audit WHERE correlation_id=$1 ORDER BY id',[correlationId])).rows;
 expect(events).toHaveLength(2);
 expect(events.map(e=>e.phase)).toEqual(['attempt','outcome']);
 expect(events.every(e=>e.server_name==='google-workspace-mcp'&&
  e.tool_name==='workspace_whoami'&&e.oauth_session_id===oauthActor.id&&
  e.grant_id===staged.id)).toBe(true);
 expect(JSON.stringify(events)).not.toContain(pass);
 for(const invalid of ['google/workspace-mcp','google--private-','localhost']){
  await expect(appendRtcReadAudit(db,{...common,service:invalid,
    correlationId:newRtcCorrelation(),phase:'attempt',outcome:'allowed'}))
   .rejects.toThrow();
 }
});
