import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {storeHubResult,readHubResult} from '../../src/results.js';
const settings={pepper:'synthetic-hub-results-test-only-pepper-32-bytes',
  resultsKey:randomBytes(32).toString('base64url')};
const actor={id:'actor-1',ownerId:'owner-1',mode:'test',
  profile:'read_only',areas:['gateway'],allowWrites:false};
let db,schema;
beforeAll(async()=>{
  if(!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL required');
  db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
  await db.connect();
  schema='hub_results_'+process.pid+'_'+Math.floor(Math.random()*100000);
  await db.query('CREATE SCHEMA "'+schema+'"');
  await db.query('SET search_path TO "'+schema+'"');
  await db.query(await readFile(new URL('../../migrations/003-hub-results.sql',
    import.meta.url),'utf8'));
});
afterAll(async()=>{
  if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}
});
it('encrypts at rest and reconstructs large UTF-8 JSON through bounded byte pages',async()=>{
  const payload={greeting:'🌌'.repeat(1800),records:[1,2,3]};
  const saved=await storeHubResult(db,actor,payload,settings);
  const {rows}=await db.query('SELECT ciphertext,handle_digest FROM hub_result_handles '+
    'WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 1',[actor.ownerId]);
  expect(rows[0].ciphertext.toString('utf8')).not.toContain('greeting');
  expect(rows[0].handle_digest).not.toBe(saved.handle);
  const chunks=[];
  for(let i=0;i<saved.pages;i++){
    const page=await readHubResult(db,actor,saved.handle,i,settings);
    expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(8192);
    chunks.push(Buffer.from(page.data,'base64url'));
  }
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toEqual(payload);
  expect(await readHubResult(db,actor,saved.handle,saved.pages,settings)).toBeNull();
});
it('binds each handle to exact caller/owner and expiry, refusing tampered ciphertext',async()=>{
  const saved=await storeHubResult(db,actor,{safe:true},settings);
  expect(await readHubResult(db,{...actor,id:'other'},saved.handle,0,settings))
    .toBeNull();
  expect(await readHubResult(db,{...actor,ownerId:'other'},saved.handle,0,settings))
    .toBeNull();
  expect(await readHubResult(db,actor,'x'.repeat(43),0,settings)).toBeNull();
  await expect(readHubResult(db,{...actor,mode:'live'},saved.handle,0,settings))
    .rejects.toThrow();
  const digest=await db.query('SELECT handle_digest FROM hub_result_handles '+
    'WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 1',[actor.ownerId]);
  await db.query('UPDATE hub_result_handles SET tag=$1 WHERE handle_digest=$2',
    [Buffer.alloc(16,1),digest.rows[0].handle_digest]);
  await expect(readHubResult(db,actor,saved.handle,0,settings)).rejects.toThrow();
  await db.query("UPDATE hub_result_handles SET created_at=now()-interval '2 days', "+
    "expires_at=now()-interval '1 day' "+
    'WHERE handle_digest=$1',[digest.rows[0].handle_digest]);
  expect(await readHubResult(db,actor,saved.handle,0,settings)).toBeNull();
});
it('refuses unconfigured encryption, unsafe caller, oversize and lifetime expansion',async()=>{
  await expect(storeHubResult(db,actor,{x:'x'.repeat(65536)},settings)).rejects.toThrow();
  await expect(storeHubResult(db,actor,{ok:true},{pepper:settings.pepper})).rejects.toThrow();
  await expect(storeHubResult(db,{...actor,mode:'live'},{ok:true},settings)).rejects.toThrow();
  await expect(storeHubResult(db,actor,{ok:true},settings,{ttlSeconds:86401})).rejects.toThrow();
});
