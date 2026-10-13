import { beforeAll, afterAll, it, expect } from 'vitest';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { issueHubPass, authenticateHubPass, revokeHubPass } from '../../src/identity.js';
import { takeBudget, appendAudit } from '../../src/limits.js';
const pepper = 'throwaway-sql-fixture-only-32-byte-unique-key';
let db, schema;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL required');
  db = new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
  await db.connect();
  schema = 'hub_auth_' + process.pid + '_' + Math.floor(Math.random()*100000);
  await db.query('CREATE SCHEMA "' + schema + '"');
  await db.query('SET search_path TO "' + schema + '"');
  await db.query(await readFile(new URL('../../migrations/001-hub-foundation.sql',import.meta.url),'utf8'));
});
afterAll(async () => {
  if (db) {
    if (schema) await db.query('DROP SCHEMA "'+schema+'" CASCADE');
    await db.end();
  }
});
it('issues one-time pass, independently authenticates and immediately revokes', async () => {
  const {pass,id} = await issueHubPass(db,{ownerId:'owner-1',profile:'read_only',
    areas:['testing'],mode:'test',allowWrites:false,ttlSeconds:300},{pepper,ownerVerified:true});
  const actor = await authenticateHubPass(db,'Bearer '+pass,{pepper});
  expect(actor).toMatchObject({id,ownerId:'owner-1',profile:'read_only',allowWrites:false,mode:'test'});
  expect(Object.isFrozen(actor)).toBe(true);
  expect(await revokeHubPass(db,id,'other',{ownerVerified:true})).toBe(false);
  expect(await revokeHubPass(db,id,'owner-1',{ownerVerified:true})).toBe(true);
  expect(await authenticateHubPass(db,'Bearer '+pass,{pepper})).toBeNull();
});
it('two independent clients share the same durable limit and audit has FK ownership', async () => {
  const client2 = new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
  await client2.connect();
  try {
    await client2.query('SET search_path TO "'+schema+'"');
    expect((await takeBudget(db,{scope:'same',pepper,max:1,now:1000})).allowed).toBe(true);
    expect((await takeBudget(client2,{scope:'same',pepper,max:1,now:1000})).allowed).toBe(false);
    const {id} = await issueHubPass(db,{ownerId:'owner',profile:'read_only',areas:[],
      mode:'test',allowWrites:false,ttlSeconds:300},{pepper,ownerVerified:true});
    expect(await appendAudit(client2,{callerId:id,action:'auth_test',outcome:'allowed'})).toBeDefined();
    await expect(appendAudit(client2,{callerId:'unknown',action:'auth_test',outcome:'allowed'}))
      .rejects.toThrow();
  } finally { await client2.end(); }
});
