import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {issueHubPass,authenticateHubPass} from '../../src/identity.js';
import {stageCallerGrant,activateVerifiedCallerGrant,revokeCallerGrant} from '../../src/grants.js';
import {createWorkflowRtcAdapter} from '../../src/workflow-rtc.js';
import {dispatchWorkflow} from '../../src/workflow-door.js';

const pepper='workflow-two-provider-disposable-fixture-pepper';
const settings={grantsKey:randomBytes(32).toString('base64url'),
 workflowKey:randomBytes(32).toString('base64url')};
const userPassByServer=new Map([
 ['stripe','rtc_pass_'+randomBytes(32).toString('base64url')],
 ['neon-mcp','rtc_pass_'+randomBytes(32).toString('base64url')]]);
const spec={workflow:'two_providers',steps:[
 {server:'stripe',tool:'stripe_create_fixture',args:{name:'one'}},
 {server:'neon-mcp',tool:'neon_create_fixture',args:{name:'two'}}]};
const areas={stripe:['billing'],'neon-mcp':['projects']};
let db,schema,actor,ids={};
const previews=[],effects=[],undo=[];
const describe=async(origin,path,{pass})=>{
 const server=origin.includes('stripe-mcp')?'stripe':'neon-mcp';
 expect(pass).toBe(userPassByServer.get(server));
 const name=path.split('/').at(-1);
 expect(name.startsWith(server==='stripe'?'stripe_':'neon_')).toBe(true);
 return {ok:true,result:{name,area:areas[server][0],profiles:['full'],
  writes:true,money:false,destructive:name.includes('delete'),
  inputSchema:{type:'object'}}};
};
const post=async(grant,name,args)=>{
 const server=grant.server;
 if(args.dryRun){
  previews.push({server,name,args});
  return {ok:true,result:{done:false,needsConfirmation:true,summary:'Would change '+server}};
 }
 expect(args.confirm).toBe(true);
 if(name.includes('delete')){
  undo.push(server);
  return {ok:true,result:{done:true,confirmed:true,summary:'Undo '+server,
    logged:{id:'reverse-'+undo.length}}};
 }
 effects.push(server);
 return {ok:true,result:{done:true,confirmed:true,summary:'Applied '+server,
  logged:{id:'provider-'+effects.length},
  inverse:{name:server==='stripe'?'stripe_delete_fixture':'neon_delete_fixture',
   args:{item:'fixture-'+server}}}};
};
const adapterFactory=(client,config)=>createWorkflowRtcAdapter(client,config,{describe,post});
const dispatch=(name,args,who=actor)=>dispatchWorkflow(name,args,who,db,settings,{adapterFactory});
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('Disposable Postgres required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='hub_workflow_public_'+process.pid+'_'+randomBytes(4).toString('hex');
 await db.query('CREATE SCHEMA "'+schema+'"');await db.query('SET search_path TO "'+schema+'"');
 for(const f of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
  '010-hub-pass-servers.sql','020-hub-service-identities.sql',
  '022-hub-workflow-runs.sql','023-hub-user-delegated-grants.sql'])
  await db.query(await readFile(new URL('../../migrations/'+f,import.meta.url),'utf8'));
 for(const server of ['stripe','neon-mcp']){
  const prefix=server==='stripe'?'stripe':'neon';
  const origin=server==='stripe'?'https://stripe-mcp-psi.vercel.app':
   'https://neon-mcp.vercel.app';
  await db.query(`INSERT INTO hub_servers
   (name,owner_id,prefix,origin,claimed_rtc,claimed_counts,state)
   VALUES($1,'owner-a',$2,$3,1,'{"tools":30,"writes":20,"money":0}','pending')`,
   [server,prefix,origin]);
 }
 const pass=await issueHubPass(db,{ownerId:'owner-a',profile:'full',mode:'test',
  allowWrites:true,areas:['gateway'],serverNames:['stripe','neon-mcp'],ttlSeconds:3600},
  {ownerVerified:true,pepper});
 actor=await authenticateHubPass(db,'Bearer '+pass.pass,{pepper});
 for(const server of ['stripe','neon-mcp']){
  const staged=await stageCallerGrant(db,{ownerId:'owner-a',serverName:server,
   callerKind:'pass',callerId:actor.id,profile:'full',mode:'test',areas:areas[server],
   pass:userPassByServer.get(server),ttlSeconds:3600},{ownerVerified:true,settings});
  ids[server]=staged.id;
  await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:staged.id},settings,
   {ownerVerified:true,inspect:async input=>({
    identityVerified:true,callable:false,server:input.name,prefix:input.prefix,
    mode:'test',profile:'full',allowWrites:true,areas:input.areas})});
 }
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('executes two independent provider passes through public plan, one confirm and reverse undo',async()=>{
 const plan=await dispatch('hub_workflow_plan',{spec});
 expect(plan.ok).toBe(true);
 expect(plan.result.previews.map(x=>x.server)).toEqual(['stripe','neon-mcp']);
 expect(previews).toHaveLength(2);
 expect(previews.every(x=>x.args.dryRun===true&&x.args.confirm===false)).toBe(true);
 expect(effects).toHaveLength(0);
 expect((await dispatch('hub_workflow_execute',{runId:plan.result.runId,spec,confirm:false})).ok)
  .toBe(false);
 const run=await dispatch('hub_workflow_execute',{runId:plan.result.runId,spec,confirm:true});
 expect(run).toMatchObject({ok:true,result:{state:'complete'}});
 expect(run.result.receipts.map(r=>r.logId)).toEqual(['provider-1','provider-2']);
 expect(effects).toEqual(['stripe','neon-mcp']);
 expect((await dispatch('hub_workflow_execute',{runId:plan.result.runId,spec,confirm:true})).ok)
  .toBe(false);
 expect(effects).toHaveLength(2);
 const status=await dispatch('hub_workflow_status',{runId:plan.result.runId});
 expect(status).toMatchObject({ok:true,result:{state:'complete',requiresReconciliation:false}});
 expect(status.result.steps.map(s=>s.logId)).toEqual(['provider-1','provider-2']);
 expect(JSON.stringify(status)).not.toContain(userPassByServer.get('stripe'));
 expect(JSON.stringify(status)).not.toContain(userPassByServer.get('neon-mcp'));
 const result=await dispatch('hub_undo_run',{runId:plan.result.runId,confirm:true});
 expect(result).toMatchObject({ok:true,result:{state:'undone'}});
 expect(undo).toEqual(['neon-mcp','stripe']);
 expect((await dispatch('hub_undo_run',{runId:plan.result.runId,confirm:true})).ok)
  .toBe(false);
 const stored=await db.query('SELECT * FROM hub_workflow_steps WHERE run_id=$1',
  [plan.result.runId]);
 expect(JSON.stringify(stored.rows)).not.toContain('fixture-stripe');
});
it('refuses wrong actor and revoked original provider grant without any new POST',async()=>{
 const wrong=await dispatch('hub_workflow_plan',{spec},{...actor,ownerId:'other'});
 expect(wrong.ok).toBe(false);
 const old=effects.length;
 expect(await revokeCallerGrant(db,{ownerId:'owner-a',id:ids.stripe},
  {ownerVerified:true})).toBe(true);
 const denied=await dispatch('hub_workflow_plan',{spec});
 expect(denied.ok).toBe(false);
 expect(effects).toHaveLength(old);
});
