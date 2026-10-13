import { describe, it, expect, vi } from 'vitest';
import { digestPass, parseBearer, issueHubPass, authenticateHubPass, revokeHubPass } from '../src/identity.js';
import { takeBudget } from '../src/limits.js';
const pepper = 'unit-only-nonsecret-hub-test-key-32bytes';
describe('Hub fail-closed credential boundary', () => {
  it('never accepts malformed or non Hub RTC bearer', () => {
    expect(parseBearer('Basic anything')).toBeNull();
    expect(parseBearer('Bearer rtc_pass_abc')).toBeNull();
    expect(digestPass('x',pepper)).toMatch(/^[a-f0-9]{64}$/);
  });
  it('refuses issuance without separate verified owner and unsupported scopes', async () => {
    const db = { query:vi.fn() };
    const input = { ownerId:'owner', profile:'read_only', mode:'test', allowWrites:false,
      areas:['testing'], ttlSeconds:600 };
    await expect(issueHubPass(db,input,{pepper})).rejects.toThrow('Verified owner');
    await expect(issueHubPass(db,{...input,allowWrites:true},{pepper,ownerVerified:true}))
      .rejects.toThrow('default');
    expect(db.query).not.toHaveBeenCalled();
    const value = await issueHubPass(db,input,{pepper,ownerVerified:true});
    expect(value.pass).toMatch(/^rtc_pass_[A-Za-z0-9_-]{43}$/);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(db.query.mock.calls)).not.toContain(value.pass);
  });
  it('returns no actor for revoked or expired passes; verified owner only revokes', async () => {
    const token = 'rtc_pass_' + 'x'.repeat(43);
    const db = { query:vi.fn().mockResolvedValue({rows:[]}) };
    expect(await authenticateHubPass(db,'Bearer '+token,{pepper})).toBeNull();
    await expect(revokeHubPass(db,'not-id','owner',{ownerVerified:true})).rejects.toThrow();
    await expect(revokeHubPass(db,'00000000-0000-0000-0000-000000000000','owner'))
      .rejects.toThrow();
  });
  it('bounds shared SQL rate increments and rejects malformed counters', async () => {
    const db = { query:vi.fn().mockResolvedValueOnce({rows:[{hits:1}]})
      .mockResolvedValueOnce({rows:[{hits:2}]}) };
    expect((await takeBudget(db,{scope:'actor',pepper,max:1,now:1000})).allowed).toBe(true);
    expect((await takeBudget(db,{scope:'actor',pepper,max:1,now:1000})).allowed).toBe(false);
    await expect(takeBudget(db,{scope:'',pepper})).rejects.toThrow();
  });
});
