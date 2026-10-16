import {randomUUID,randomBytes} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {storeRtcResult,readRtcResult,pruneExpiredRtcResults} from '../../src/rtc-results.js';

const settings={pepper:'synthetic-rtc-results-ci-only-test-pepper-32',
 resultsKey:randomBytes(32).toString('base64url')};
const actor={id:randomUUID(),ownerId:'test-owner',profile:'full',mode:'test',
 areas:['gateway'],allowWrites:false,clientId:'ci-only'};
const grant={grantId:randomUUID(),server:'stripe',prefix:'stripe'};
let db,schema;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();
 schema='rtc_results_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 await db.query(await readFile(new URL('../../migrations/009-hub-rtc-results.sql',
  import.meta.url),'utf8'));
 await db.query(await readFile(new URL('../../migrations/020-hub-service-identities.sql',
  import.meta.url),'utf8'));
});
afterAll(async()=>{
 if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}
});
const active=()=>({resolve:async()=>grant});
it('roundtrips 64KiB-bounded encrypted RTC JSON through 4KiB opaque byte pages',async()=>{
 const payload={name:'stripe_invoice_list',result:{items:'🌍'.repeat(1900)}};
 const stored=await storeRtcResult(db,actor,grant.grantId,grant.server,payload,settings);
 expect(stored.pages).toBeGreaterThan(1);
 expect(stored.readTool).toBe('hub_result_read');
 const {rows}=await db.query('SELECT ciphertext,handle_digest FROM hub_rtc_result_handles');
 expect(rows.some(x=>x.ciphertext.toString('utf8').includes('stripe_invoice_list'))).toBe(false);
 expect(rows.some(x=>x.handle_digest===stored.handle)).toBe(false);
 const parts=[];
 for(let page=0;page<stored.pages;page++){
  const chunk=await readRtcResult(db,actor,stored.handle,page,settings,active());
  expect(Buffer.byteLength(JSON.stringify(chunk),'utf8')).toBeLessThan(8192);
  parts.push(Buffer.from(chunk.data,'base64url'));
 }
 expect(JSON.parse(Buffer.concat(parts).toString('utf8'))).toEqual(payload);
 expect(await readRtcResult(db,actor,stored.handle,stored.pages,settings,active())).toBeNull();
});
it('refuses different callers, owners, revoked/replaced grants, tampered bytes and expired handles',async()=>{
 const stored=await storeRtcResult(db,actor,grant.grantId,grant.server,
  {token:'synthetic public fixture'},settings);
 expect(await readRtcResult(db,{...actor,id:randomUUID()},stored.handle,0,settings,active()))
  .toBeNull();
 expect(await readRtcResult(db,{...actor,ownerId:'other-owner'},stored.handle,0,settings,active()))
  .toBeNull();
 expect(await readRtcResult(db,actor,stored.handle,0,settings,
  {resolve:async()=>null})).toBeNull();
 expect(await readRtcResult(db,actor,stored.handle,0,settings,
  {resolve:async()=>({...grant,grantId:randomUUID()})})).toBeNull();
 const {rows}=await db.query('SELECT handle_digest FROM hub_rtc_result_handles ORDER BY created_at DESC LIMIT 1');
 await db.query('UPDATE hub_rtc_result_handles SET tag=$1 WHERE handle_digest=$2',
  [Buffer.alloc(16,0),rows[0].handle_digest]);
 await expect(readRtcResult(db,actor,stored.handle,0,settings,active())).rejects.toThrow();
 await db.query('UPDATE hub_rtc_result_handles SET created_at=now()-interval \'2 hours\', expires_at=now()-interval \'1 hour\' WHERE handle_digest=$1',
  [rows[0].handle_digest]);
 expect(await readRtcResult(db,actor,stored.handle,0,settings,active())).toBeNull();
});
it('fails closed on invalid callers, missing encryption and results above the 64KiB limit',async()=>{
 await expect(storeRtcResult(db,actor,grant.grantId,grant.server,
   {x:'x'.repeat(65536)},settings)).rejects.toThrow();
 await expect(storeRtcResult(db,{...actor,mode:'live'},grant.grantId,grant.server,
   {},settings)).rejects.toThrow();
 await expect(storeRtcResult(db,actor,grant.grantId,grant.server,{},
   {...settings,resultsKey:undefined})).rejects.toThrow();
 expect(await readRtcResult(db,actor,'fake',0,settings,active())).toBeNull();
});

it('collects only expired encrypted RTC pages in small bounded batches',async()=>{
 await db.query('DELETE FROM hub_rtc_result_handles');
 for(let i=0;i<3;i++)
  await storeRtcResult(db,actor,grant.grantId,grant.server,
   {index:i},settings);
 const first=await db.query(`SELECT handle_digest FROM hub_rtc_result_handles
  ORDER BY created_at,handle_digest LIMIT 2`);
 await db.query(`UPDATE hub_rtc_result_handles
  SET created_at=now()-interval '2 hours', expires_at=now()-interval '1 hour'
  WHERE handle_digest=ANY($1::text[])`,[first.rows.map(r=>r.handle_digest)]);
 expect(await pruneExpiredRtcResults(db,{limit:1})).toBe(1);
 const remain=await db.query(`SELECT count(*)::integer n FROM hub_rtc_result_handles
  WHERE expires_at<=now()`);
 expect(remain.rows[0].n).toBe(1);
 // Ordinary storage opportunistically cleans remaining expired entries.
 await storeRtcResult(db,actor,grant.grantId,grant.server,
  {index:'new'},settings);
 const active=await db.query(`SELECT count(*)::integer n FROM hub_rtc_result_handles`);
 expect(active.rows[0].n).toBe(2);
 expect(await pruneExpiredRtcResults(db,{limit:100})).toBe(0);
 for(const limit of [0,101,1.5,-1]) {
  await expect(pruneExpiredRtcResults(db,{limit})).rejects.toThrow();
 }
});

it('roundtrips encrypted pages bound to a canonical hyphenated RTC server',async()=>{
 const workspace={...grant,server:'google-workspace-mcp'};
 const payload={name:'workspace_drive_list',items:['synthetic-read-only']};
 const stored=await storeRtcResult(db,actor,workspace.grantId,workspace.server,
  payload,settings);
 const page=await readRtcResult(db,actor,stored.handle,0,settings,
  {resolve:async()=>workspace});
 expect(JSON.parse(Buffer.from(page.data,'base64url').toString('utf8'))).toEqual(payload);
 expect(await readRtcResult(db,actor,stored.handle,0,settings,
  {resolve:async()=>grant})).toBeNull();
});
