import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {summarizeHubReadiness,handleOwnerReadiness} from '../../src/owner-readiness.js';
const owner='readiness-owner';
const settings={grantsKey:randomBytes(32).toString('base64url'),
 resultsKey:randomBytes(32).toString('base64url')};
let db,schema;
beforeAll(async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL);
 if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Disposable localhost only');
 db=new pg.Client({connectionString:url.href});await db.connect();
 schema='hub_readiness_'+process.pid+'_'+randomBytes(4).toString('hex');
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 const dir=new URL('../../migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())
  await db.query(await readFile(new URL(file,dir),'utf8'));
 for(const [name,ownerId] of [['alpha','readiness-owner'],['beta','readiness-owner'],['foreign','another-owner']])
  await db.query(`INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,state,claimed_counts)
   VALUES($1,$2,$1,$3,1,'active','{"tools":1,"writes":0,"money":0}')`,[name,ownerId,'https://'+name+'.example.org']);
 let n=0;
 for(const [server,mode,revoked,expired] of [
  ['alpha','test',false,false],['alpha','test',false,false],
  ['alpha','live',false,false],['beta','live',true,false],
  ['beta','test',false,true],['foreign','live',false,false]]){
  const id='readiness-caller-'+(++n),ownerId=server==='foreign'?'another-owner':owner;
  await db.query(`INSERT INTO hub_callers(id,owner_id,pass_digest,profile,mode,expires_at)
   VALUES($1,$2,$1,'read_only',$3,now()+interval '1 hour')`,[id,ownerId,mode]);
  await db.query(`INSERT INTO hub_server_grants(id,owner_id,server_name,caller_kind,caller_id,
   pass_caller_id,profile,mode,areas,ciphertext,nonce,tag,created_at,expires_at,revoked_at,verified_at)
   VALUES($1,$2,$3,'pass',$4,$4,'read_only',$5,ARRAY['reports'],
    $6,$7,$8,now()-interval '2 hours',
    CASE WHEN $9 THEN now()-interval '1 hour' ELSE now()+interval '1 hour' END,
    CASE WHEN $10 THEN now() ELSE NULL END,now())`,
   [randomUUID(),ownerId,server,id,mode,Buffer.from('noncredential-fixture'),Buffer.alloc(12),Buffer.alloc(16),expired,revoked]);
 }
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
const summary=()=>summarizeHubReadiness(db,owner,settings);
it('checks actual selected-grant and optional OAuth-write migration definitions',async()=>{
 const state=await summary();
 expect(state).toMatchObject({schemaReady:true,installedTables:4,
  liveGrantSchemaReady:true,oauthWriteSchemaReady:true,
  servers:2,activeServers:2});
 expect(state.modes).toEqual({test:{unexpiredGrants:2,verifiedGrants:2,registeredServices:1},
  live:{unexpiredGrants:1,verifiedGrants:1,registeredServices:1}});
});
it('does not select private credentials or mutate grant/caller rows through owner POST',async()=>{
 const before=(await db.query('SELECT * FROM hub_server_grants ORDER BY id')).rows;
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},send(body){this.body=body;return this;}};
 const statements=[];
 const readDb={query:(sql,args)=>{statements.push(sql);return db.query(sql,args);}};
 await handleOwnerReadiness({method:'POST',body:'password=fixture-owner',headers:{'content-type':'application/x-www-form-urlencoded'}},res,{
  env:{HUB_PUBLIC_ORIGIN:'https://hub.example.org',HUB_OWNER_ID:owner},
  withDb:fn=>fn(readDb,settings),verify:async()=>({approved:true})});
 expect(res.code).toBe(200);
 expect(res.headers['Cache-Control']).toBe('no-store');
 expect(res.body).toContain('LIVE read configuration preflight: ready');
 expect(res.body).toContain('Two-service TEST routing preflight: not ready');
 expect(res.body).not.toContain('readiness-caller-');
 expect(res.body).not.toContain('noncredential-fixture');
 for(const sql of statements)expect(sql).not.toMatch(/ciphertext|pass_digest|INSERT|UPDATE|DELETE|ALTER/i);
 expect((await db.query('SELECT * FROM hub_server_grants ORDER BY id')).rows).toEqual(before);
});
it('reports older or drifted grant constraints without modifying them',async()=>{
 await db.query('BEGIN');
 try{
  await db.query('ALTER TABLE hub_server_grants DROP CONSTRAINT hub_grant_selected_mode');
  expect((await summary()).liveGrantSchemaReady).toBe(false);
  await db.query("ALTER TABLE hub_server_grants ADD CONSTRAINT hub_grant_selected_mode CHECK(mode IN ('test','live','wrong'))");
  expect((await summary()).liveGrantSchemaReady).toBe(false);
 }finally{await db.query('ROLLBACK');}
 expect((await summary()).liveGrantSchemaReady).toBe(true);
});
it('reports missing OAuth write migration separately without blocking live read configuration',async()=>{
 await db.query('BEGIN');
 try{
  await db.query('ALTER TABLE hub_oauth_sessions DROP COLUMN allow_writes CASCADE');
  expect(await summary()).toMatchObject({liveGrantSchemaReady:true,oauthWriteSchemaReady:false});
 }finally{await db.query('ROLLBACK');}
});
it('survives old schema with four tables but without verified_at',async()=>{
 await db.query('BEGIN');
 try{
  await db.query('ALTER TABLE hub_server_grants RENAME COLUMN verified_at TO older_verified_at');
  expect(await summary()).toMatchObject({installedTables:4,schemaReady:false,liveGrantSchemaReady:false});
 }finally{await db.query('ROLLBACK');}
});
it('foreign owner counts never appear and revoked/expired records do not become ready',async()=>{
 const foreign=await summarizeHubReadiness(db,'another-owner',settings);
 expect(foreign.servers).toBe(1);expect(foreign.modes.test.registeredServices).toBe(0);
 expect(foreign.modes.live.registeredServices).toBe(1);
 await db.query('BEGIN');
 try{
  await db.query('UPDATE hub_server_grants SET revoked_at=now() WHERE owner_id=$1 AND mode=$2',[owner,'live']);
  expect((await summary()).modes.live).toEqual({unexpiredGrants:0,verifiedGrants:0,registeredServices:0});
 }finally{await db.query('ROLLBACK');}
});
it('disabled registration cannot satisfy configuration, without changing stored grant counts',async()=>{
 await db.query('BEGIN');
 try{
  await db.query("UPDATE hub_servers SET state='disabled' WHERE name='alpha'");
  const state=await summary();
  expect(state.modes.test).toEqual({unexpiredGrants:2,verifiedGrants:2,registeredServices:0});
  expect(state.modes.live.registeredServices).toBe(0);
 }finally{await db.query('ROLLBACK');}
});
