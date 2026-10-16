import {it,expect,beforeAll,afterAll} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {ownerRecovery} from '../../src/owner-recovery.js';
import {verifyOwnerPassword} from '../../src/owner-login.js';
let db,schema;
const code=randomBytes(32).toString('base64url'),password='synthetic-owner-original-2026',
 replacement='synthetic-owner-new-2026';
const env={HUB_OWNER_ID:'test-owner',HUB_TOKEN_PEPPER:'synthetic-db-pepper-32-bytes-never-live',
 HUB_OWNER_RECOVERY_CODE:code,HUB_OWNER_RECOVERY_EXPIRES:new Date(Date.now()+3600000).toISOString()};
const budget=async()=>({allowed:true});
const req=(pass,recoveryCode=code)=>({method:'POST',body:{recovery_code:recoveryCode,password:pass,confirmation:pass}});
beforeAll(async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL);
 if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Only disposable localhost database');
 db=new pg.Client({connectionString:url.href});await db.connect();
 schema='hub_owner_recovery_'+process.pid;
 await db.query('CREATE SCHEMA "'+schema+'"');await db.query('SET search_path TO "'+schema+'"');
 for(const f of ['001-hub-foundation.sql','002-hub-oauth.sql','007-hub-developer.sql','021-hub-owner-recovery.sql'])
  await db.query(await readFile(new URL('../../migrations/'+f,import.meta.url),'utf8'));
 await db.query('INSERT INTO hub_owner_credentials(owner_id,verifier) VALUES($1,$2)',[
  env.HUB_OWNER_ID,'s1.'+'a'.repeat(22)+'.'+'a'.repeat(43)]);
});
afterAll(async()=>{if(db){await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('keeps original verifier until valid recovery; once used it can never rotate again',async()=>{
 const existing=(await db.query('SELECT verifier FROM hub_owner_credentials WHERE owner_id=$1',[env.HUB_OWNER_ID])).rows[0].verifier;
 const denied=await ownerRecovery(db,req(replacement,'A'.repeat(43)),{env,budget});
 expect(denied.status).toBe(403);
 expect((await db.query('SELECT verifier FROM hub_owner_credentials WHERE owner_id=$1',[env.HUB_OWNER_ID])).rows[0].verifier).toBe(existing);
 const ok=await ownerRecovery(db,req(replacement),{env,budget});
 expect(ok.status).toBe(200);
 const saved=(await db.query('SELECT verifier FROM hub_owner_credentials WHERE owner_id=$1',[env.HUB_OWNER_ID])).rows[0].verifier;
 expect(saved).not.toBe(existing);expect(verifyOwnerPassword(replacement,saved)).toBe(true);
 expect(saved).not.toContain(replacement);
 const attempts=await ownerRecovery(db,req(password),{env,budget});
 expect(attempts.status).toBe(409);
 const rows=(await db.query('SELECT code_digest FROM hub_owner_recovery_uses')).rows;
 expect(rows).toHaveLength(1);
 expect(rows[0].code_digest).toMatch(/^[a-f0-9]{64}$/);
 expect((await db.query('SELECT verifier FROM hub_owner_credentials WHERE owner_id=$1',[env.HUB_OWNER_ID])).rows[0].verifier).toBe(saved);
});
