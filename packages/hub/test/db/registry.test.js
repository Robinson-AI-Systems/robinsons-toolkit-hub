import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {stageHubServer,listStagedServers,disableStagedServer} from '../../src/registry.js';
let db,schema;
const claimed={rtc:1,server:'stripe',prefix:'stripe',modes:['test'],
  profiles:['read_only'],counts:{tools:51,writes:7,money:2}};
const input={ownerId:'owner-a',name:'stripe',prefix:'stripe',
  origin:'https://stripe-mcp-psi.vercel.app',manifest:claimed};
beforeAll(async()=>{
  if(!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL required');
  db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
  await db.connect();
  schema='hub_registry_'+process.pid+'_'+Math.floor(Math.random()*100000);
  await db.query('CREATE SCHEMA "'+schema+'"');
  await db.query('SET search_path TO "'+schema+'"');
  await db.query(await readFile(new URL('../../migrations/004-hub-registry.sql',
    import.meta.url),'utf8'));
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('persists only pending public claims and isolates owner inspection',async()=>{
  await stageHubServer(db,input,{ownerVerified:true});
  const saved=await db.query('SELECT * FROM hub_servers WHERE name=$1',['stripe']);
  expect(saved.rows[0]).toMatchObject({owner_id:'owner-a',state:'pending',claimed_rtc:1});
  expect(JSON.stringify(saved.rows[0])).not.toContain('rtc_pass_');
  expect(await listStagedServers(db,'owner-b',{ownerVerified:true})).toEqual([]);
  expect(await listStagedServers(db,'owner-a',{ownerVerified:true}))
    .toEqual([expect.objectContaining({verified:false,callable:false})]);
  await expect(stageHubServer(db,{...input,name:'stripe2',prefix:'stripe'},
    {ownerVerified:true})).rejects.toThrow();
  await expect(stageHubServer(db,{...input,name:'stripe'},
    {ownerVerified:true})).rejects.toThrow();
  expect(await disableStagedServer(db,{ownerId:'owner-b',name:'stripe'},
    {ownerVerified:true})).toBe(false);
  expect(await disableStagedServer(db,{ownerId:'owner-a',name:'stripe'},
    {ownerVerified:true})).toBe(true);
  expect((await db.query('SELECT state FROM hub_servers WHERE name=$1',['stripe']))
    .rows[0].state).toBe('disabled');
});
