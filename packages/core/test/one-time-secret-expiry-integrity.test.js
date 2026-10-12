import {describe,it,expect,vi} from 'vitest';
import {createOneTimeSecretStore} from '../src/one-time-secrets.js';

function fixture() {
  let clock=1000000;
  const key=Buffer.alloc(32,7),rows=new Map();
  const db={
    addOneTimeSecret:vi.fn(async row=>rows.set(row.id,{...row})),
    consumeOneTimeSecret:vi.fn(async id=>{
      const row=rows.get(id);rows.delete(id);return row??null;
    })
  };
  const adapters={db,encryptionKey:key,
    contextFor:({id,account,mode,kind})=>[id,account,mode,kind].join('|'),
    setupPathFor:id=>'/api/secret?show='+id,accountFromRow:vi.fn(row=>row.account),
    now:()=>clock};
  const store=createOneTimeSecretStore(adapters);
  const issue=()=>store.issue({account:'tenant-a',mode:'test',kind:'setup',
    secret:'synthetic-fixture-only'});
  return {key,db,rows,adapters,store,issue,now:()=>clock,advance:delta=>{clock+=delta;}};
}

describe('portable one-time secrets resist key alias and source-row expiry drift',()=>{
  it('keeps an isolated encryption key despite caller overwriting its Buffer',async()=>{
    const f=fixture(),{id}=await f.issue();
    f.key.fill(0);
    expect(await f.store.consume(id)).toBe('synthetic-fixture-only');
    const {id:next}=await f.issue();
    expect(await f.store.consume(next)).toBe('synthetic-fixture-only');
    // A different store may only use the actually supplied current key.
    const afterRotation=createOneTimeSecretStore(f.adapters);
    const {id:oldKeyId}=await f.issue();
    await expect(afterRotation.consume(oldKeyId)).rejects.toThrow(/Unable to decrypt/);
  });
  it('rejects a stale row even if a buggy SQL adapter returns it as consumed',async()=>{
    const f=fixture(),{id}=await f.issue();
    const stale={...f.rows.get(id),expiresAt:new Date(f.now()-1)};
    f.db.consumeOneTimeSecret.mockResolvedValueOnce(stale);
    await expect(f.store.consume(id)).rejects.toThrow(/Expired or inconsistent/);
    expect(f.adapters.accountFromRow).not.toHaveBeenCalled();
  });
  it('accepts valid Postgres-style expiry and refuses contradictory aliases',async()=>{
    const f=fixture();
    const {id}=await f.issue(),original=f.rows.get(id);
    const good={...original,expires_at:new Date(original.expiresAt.getTime())};
    f.db.consumeOneTimeSecret.mockResolvedValueOnce(good);
    expect(await f.store.consume(id)).toBe('synthetic-fixture-only');
    const {id:next}=await f.issue(),row=f.rows.get(next);
    f.db.consumeOneTimeSecret.mockResolvedValueOnce({...row,
      expires_at:new Date(row.expiresAt.getTime()+1000)});
    await expect(f.store.consume(next)).rejects.toThrow(/inconsistent/);
  });
  it('rejects invalid expiry values, proxy dates and invalid consumed clock',async()=>{
    const invalid=[undefined,'2026-01-01',NaN,{},new Date(NaN)];
    for(const expiry of invalid) {
      const f=fixture(),{id}=await f.issue();
      f.db.consumeOneTimeSecret.mockResolvedValueOnce({
        ...f.rows.get(id),expiresAt:expiry
      });
      await expect(f.store.consume(id)).rejects.toThrow(/expiry/);
      expect(f.adapters.accountFromRow).not.toHaveBeenCalled();
    }
    const f=fixture(),{id}=await f.issue();
    const row=f.rows.get(id);
    const badClock=createOneTimeSecretStore({...f.adapters,now:()=>Infinity});
    f.db.consumeOneTimeSecret.mockResolvedValueOnce(row);
    await expect(badClock.consume(id)).rejects.toThrow(/clock/);
    const other=fixture(),{id:proxyId}=await other.issue();
    other.db.consumeOneTimeSecret.mockResolvedValueOnce({
      ...other.rows.get(proxyId),expiresAt:new Proxy(new Date(other.now()+2000),{})
    });
    await expect(other.store.consume(proxyId)).rejects.toThrow(/expiry/);
  });
  it('does not run shadowed getTime on a Date returned from service SQL',async()=>{
    const f=fixture(),{id}=await f.issue();
    const expiry=new Date(f.now()+600000);
    let getters=0;
    Object.defineProperty(expiry,'getTime',{get(){getters++;return ()=>0;}});
    f.db.consumeOneTimeSecret.mockResolvedValueOnce({...f.rows.get(id),expiresAt:expiry});
    expect(await f.store.consume(id)).toBe('synthetic-fixture-only');
    expect(getters).toBe(0);
  });
  it('preserves legacy rows without expiry evidence but does not certify SQL acceptance',async()=>{
    const f=fixture(),{id}=await f.issue(),row=f.rows.get(id);
    const {expiresAt:_unused,...legacy}=row;
    f.db.consumeOneTimeSecret.mockResolvedValueOnce(legacy);
    expect(await f.store.consume(id)).toBe('synthetic-fixture-only');
    // Every adopting service is still required to atomically consume only
    // unexpired, account-bound rows in its own SQL.
  });
});
