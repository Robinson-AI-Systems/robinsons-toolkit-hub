import {it,expect,vi} from 'vitest';
import {ownerRecovery} from '../src/owner-recovery.js';
const secret='Z'.repeat(43),pass='synthetic-new-owner-passphrase';
const env=()=>({HUB_OWNER_ID:'test-owner',HUB_TOKEN_PEPPER:'synthetic-test-pepper-never-in-production',
 HUB_OWNER_RECOVERY_CODE:secret,HUB_OWNER_RECOVERY_EXPIRES:new Date(Date.now()+3600_000).toISOString()});
const good=()=>({method:'POST',body:{recovery_code:secret,password:pass,confirmation:pass}});
const budget=async()=>({allowed:true});
it('offers secure password form only while a bounded one-time recovery is configured',async()=>{
 const db={query:vi.fn()};
 const form=await ownerRecovery(db,{method:'GET',query:{}},{env:env()});
 expect(form.status).toBe(200);
 expect(form.html).toContain('autocomplete="new-password"');
 expect(form.html).not.toContain(secret);
 expect(await ownerRecovery(db,{method:'GET',query:{}},{env:{...env(),HUB_OWNER_SCRYPT:'s1.existing'}}))
  .toMatchObject({status:503});
 for(const config of [
  {...env(),HUB_OWNER_RECOVERY_CODE:undefined},
  {...env(),HUB_OWNER_RECOVERY_CODE:'weak'},
  {...env(),HUB_TOKEN_PEPPER:undefined},
  {...env(),HUB_OWNER_RECOVERY_EXPIRES:new Date(Date.now()-1000).toISOString()},
  {...env(),HUB_OWNER_RECOVERY_EXPIRES:new Date(Date.now()+90*3600_000).toISOString()}
 ])expect((await ownerRecovery(db,{method:'GET',query:{}},{env:config})).status).toBe(503);
 expect(db.query).not.toHaveBeenCalled();
});
it('rejects guessing, invalid input, passphrase mismatch and lockout before any SQL mutation',async()=>{
 const query=vi.fn(),db={query},cfg=env();
 const no=async req=>ownerRecovery(db,req,{env:cfg,budget});
 for(const request of [
  {...good(),body:{...good().body,recovery_code:'X'.repeat(43)}},
  {...good(),body:{...good().body,password:'mismatch'}},
  {...good(),body:{...good().body,password:'too-short',confirmation:'too-short'}},
  {...good(),body:{...good().body,extra:'unapproved'}},
  {...good(),body:{...good().body,recovery_code:''}},
 ])expect((await no(request)).status).toBeGreaterThanOrEqual(400);
 expect(query).not.toHaveBeenCalled();
 expect((await ownerRecovery(db,good(),{env:cfg,budget:async()=>({allowed:false})})).status).toBe(429);
 expect(query).not.toHaveBeenCalled();
});
it('atomically stores only scrypt verifier and one-use keyed digest, never raw secrets',async()=>{
 const query=vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{owner_id:'test-owner'}]})
  .mockResolvedValueOnce({rows:[{owner_id:'test-owner'}]}).mockResolvedValueOnce({});
 const db={query},r=await ownerRecovery(db,good(),{env:env(),budget});
 expect(r.status).toBe(200);
 expect(query.mock.calls.map(x=>x[0]).join(' ')).toMatch(/BEGIN.*INSERT.*UPDATE.*COMMIT/s);
 const consume=query.mock.calls[1][1],update=query.mock.calls[2][1];
 expect(consume[1]).toMatch(/^[a-f0-9]{64}$/);
 expect(update[1]).toMatch(/^s1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
 expect(JSON.stringify(query.mock.calls)).not.toContain(secret);
 expect(JSON.stringify(query.mock.calls)).not.toContain(pass);
 expect(r.html).not.toContain(secret);
 expect(r.html).not.toContain(pass);
});
it('refuses consumed code and rolls back a failed credential update',async()=>{
 const no={query:vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({})};
 expect((await ownerRecovery(no,good(),{env:env(),budget})).status).toBe(409);
 expect(no.query.mock.calls.map(x=>x[0])).toEqual([
  'BEGIN',expect.stringContaining('INSERT INTO hub_owner_recovery_uses'),'ROLLBACK']);
 const fail={query:vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{owner_id:'test-owner'}]})
  .mockRejectedValueOnce(new Error('db failure')).mockResolvedValueOnce({})};
 await expect(ownerRecovery(fail,good(),{env:env(),budget})).rejects.toThrow('db failure');
 expect(fail.query.mock.calls.at(-1)[0]).toBe('ROLLBACK');
});
it('accepts protected-deployment GET access query without treating it as authority',async()=>{
 const db={query:vi.fn()},cfg=env();
 for(const query of [{_vercel_share:'opaque-share-token'},
  {_vercel_protection_bypass:'opaque-bypass-token'},{unexpected:'anything'}]){
  const r=await ownerRecovery(db,{method:'GET',query},{env:cfg});
  expect(r.status).toBe(200);
  expect(r.html).toContain('name="recovery_code"');
  expect(r.html).not.toContain('opaque-');
  expect(r.html).not.toContain('anything');
 }
 expect(db.query).not.toHaveBeenCalled();
});
