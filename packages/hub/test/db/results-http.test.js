import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import pg from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {handleHubResult} from '../../src/results-http.js';
import {hubActor} from '../../src/runtime.js';
import {issueHubPass,authenticateHubPass,revokeHubPass} from '../../src/identity.js';
import {stageCallerGrant,activateVerifiedCallerGrant,revokeCallerGrant} from '../../src/grants.js';
import {runFederatedBroker} from '../../src/federation.js';
import {storeHubResult} from '../../src/results.js';
const owner='result-http-owner';
const settings={pepper:'synthetic-result-http-pepper-only-32bytes',
 grantsKey:randomBytes(32).toString('base64url'),resultsKey:randomBytes(32).toString('base64url')};
const payload={items:'漢🙂'.repeat(2300)};
let db,schema;
beforeAll(async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Disposable localhost only');
 db=new pg.Client({connectionString:url.href});await db.connect();schema='result_http_'+process.pid+'_'+randomBytes(4).toString('hex');
 await db.query('CREATE SCHEMA "'+schema+'"');await db.query('SET search_path TO "'+schema+'"');
 const dir=new URL('../../migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.query(await readFile(new URL(f,dir),'utf8'));
 await db.query(`INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
  VALUES('reports',$1,'reports','https://reports.example.org',1,'{"tools":1,"writes":0,"money":0}')`,[owner]);
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
async function attachGrant(actor,mode,profile,writes){
 const staged=await stageCallerGrant(db,{ownerId:owner,serverName:'reports',callerKind:'pass',callerId:actor.id,
  profile,mode,areas:['reports'],pass:'rtc_pass_'+randomBytes(32).toString('base64url'),ttlSeconds:3600},{ownerVerified:true,settings});
 await activateVerifiedCallerGrant(db,{ownerId:owner,id:staged.id},settings,{ownerVerified:true,
  inspect:async()=>({server:'reports',prefix:'reports',profile,mode,areas:['reports'],allowWrites:writes,identityVerified:true,callable:false})});
 return staged;
}
async function fixture(mode='live',writes=false){
 const profile=writes?'full':'read_only';
 const issued=await issueHubPass(db,{ownerId:owner,profile,mode,allowWrites:writes,areas:['gateway'],
  serverNames:['reports'],ttlSeconds:3600},{ownerVerified:true,pepper:settings.pepper});
 const actor=await authenticateHubPass(db,'Bearer '+issued.pass,settings);
 const staged=await attachGrant(actor,mode,profile,writes);
 const read=vi.fn(async()=>({ok:true,result:payload,logged:{id:'synthetic-provider-read-log'}}));
 const result=await runFederatedBroker('hub_call',{name:'reports_list_items',args:{}},actor,db,settings,{
  describe:async()=>({name:'reports_list_items',area:'reports',profiles:['read_only','everyday','full'],
   writes:false,money:false,destructive:false,annotations:{readOnlyHint:true}}),read});
 expect(result.ok).toBe(true);expect(result.result.stored).toBe(true);
 return {issued,actor,grant:staged.id,stored:result.result,read};
}
async function route(handle,pass,page=0){
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
 await handleHubResult({method:'GET',query:{handle,page},headers:{authorization:'Bearer '+pass}},res,{
  withDb:fn=>fn(db,settings),authorize:hubActor});return res;
}
it.each([['test',false],['live',false],['test',true],['live',true]])(
 'assembles actual federated encrypted read via HTTP in %s delegated=%s with no replay',async(mode,writes)=>{
 const f=await fixture(mode,writes),parts=[];
 for(let page=0;page<f.stored.pages;page++){
  const res=await route(f.stored.handle,f.issued.pass,page);expect(res.code).toBe(200);
  expect(res.headers['Cache-Control']).toBe('no-store');
  expect(Buffer.byteLength(JSON.stringify(res.body))).toBeLessThan(8192);
  parts.push(Buffer.from(res.body.result.data,'base64url'));
 }
 const assembled=JSON.parse(Buffer.concat(parts).toString('utf8'));
 expect(assembled).toMatchObject({name:'reports_list_items',server:'reports',result:payload});
 expect(assembled.result).toEqual(payload);
 expect(f.read).toHaveBeenCalledTimes(1);
});
it('denies other callers and revoked Hub/provider grants on the actual HTTP path',async()=>{
 const a=await fixture(),b=await fixture();
 expect((await route(a.stored.handle,b.issued.pass)).code).toBe(404);
 await revokeCallerGrant(db,{ownerId:owner,id:a.grant},{ownerVerified:true});
 expect((await route(a.stored.handle,a.issued.pass)).code).toBe(404);
 const replacement=await attachGrant(a.actor,'live','read_only',false);
 expect(replacement.id).not.toBe(a.grant);
 expect((await route(a.stored.handle,a.issued.pass)).code).toBe(404);
 await revokeHubPass(db,b.actor.id,owner,{ownerVerified:true});
 expect((await route(b.stored.handle,b.issued.pass)).code).toBe(401);
 expect(a.read).toHaveBeenCalledTimes(1);expect(b.read).toHaveBeenCalledTimes(1);
});
it('expired handles and stale actors after persisted scope removal cannot read a page',async()=>{
 const f=await fixture();
 await db.query('BEGIN');
 try{
  await db.query("UPDATE hub_rtc_result_handles SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE grant_id=$1",[f.grant]);
  expect((await route(f.stored.handle,f.issued.pass)).code).toBe(404);
 }finally{await db.query('ROLLBACK');}
 await db.query('BEGIN');
 try{
  await db.query("UPDATE hub_callers SET mode='test' WHERE id=$1",[f.actor.id]);
  expect((await route(f.stored.handle,f.issued.pass)).code).toBe(404);
 }finally{await db.query('ROLLBACK');}
 await db.query("UPDATE hub_callers SET allowed_servers=ARRAY[]::text[] WHERE id=$1",[f.actor.id]);
 expect((await route(f.stored.handle,f.issued.pass)).code).toBe(404);
});
it('legacy TEST result works while an independently valid LIVE caller still cannot access it',async()=>{
 const f=await fixture('test'),live=await fixture('live');
 const stored=await storeHubResult(db,f.actor,{legacy:'owned TEST result'},settings);
 expect((await route(stored.handle,f.issued.pass)).code).toBe(200);
 expect((await route(stored.handle,live.issued.pass)).code).toBe(403);
});
