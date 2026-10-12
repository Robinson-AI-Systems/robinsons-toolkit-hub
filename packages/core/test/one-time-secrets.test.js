import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createOneTimeSecretStore } from '../src/one-time-secrets.js';

function fixture({ contextPrefix = 'stripe-once', accountField = 'stripe_account' } = {}) {
  const key = randomBytes(32), rows = new Map(), received = [];
  let now = 1000000;
  const db = {
    addOneTimeSecret: vi.fn(async row => {
      received.push(row);
      rows.set(row.id, { ...row, [accountField]: row.account });
    }),
    consumeOneTimeSecret: vi.fn(async id => {
      const row=rows.get(id);
      if (!row || row.expiresAt.getTime() <= now) return null;
      rows.delete(id);
      return row;
    })
  };
  const adapters = {
    db, encryptionKey: key,
    contextFor: ({id,account,mode,kind}) =>
      [contextPrefix,id,account||'',mode||'',kind].join('/'),
    setupPathFor: id => '/api/stripe/setup?show='+encodeURIComponent(id),
    accountFromRow: row => row[accountField],
    now: () => now
  };
  return { adapters, db, key, rows, received, advance:ms=>{ now+=ms; },
    store: createOneTimeSecretStore(adapters) };
}
describe('private one-time secret adapter', () => {
  it('issues a 32-character opaque id, only stores AES-GCM ciphertext, and consumes exactly once', async () => {
    const f=fixture();
    const issued=await f.store.issue({
      account:'acct_example',mode:'test',kind:'setup',secret:'synthetic-non-credential-value'
    });
    expect(issued.id).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(issued.setupPath).toBe('/api/stripe/setup?show='+issued.id);
    expect(f.received).toHaveLength(1);
    expect(f.received[0].expiresAt.getTime()).toBe(1600000);
    expect(f.received[0].ciphertext).toMatch(/^v1\./);
    expect(JSON.stringify(f.received)).not.toContain('synthetic-non-credential-value');
    expect(await f.store.consume(issued.id)).toBe('synthetic-non-credential-value');
    expect(await f.store.consume(issued.id)).toBeNull();
    expect(f.db.consumeOneTimeSecret).toHaveBeenCalledTimes(2);
  });
  it('rejects invalid ids and expired rows without decrypting or exposing data', async () => {
    const f=fixture();
    for (const id of ['',null,'../token','a'.repeat(31),'a'.repeat(33)]) {
      expect(await f.store.consume(id)).toBeNull();
    }
    expect(f.db.consumeOneTimeSecret).not.toHaveBeenCalled();
    const {id}=await f.store.issue({kind:'setup',secret:'synthetic-data'});
    f.advance(600000);
    expect(await f.store.consume(id)).toBeNull();
  });
  it('binds existing Stripe AAD to exact id, account, mode and kind; altered row fails closed', async () => {
    const f=fixture();
    const {id}=await f.store.issue({account:'acct_one',mode:'test',kind:'api',secret:'not-a-real-pass'});
    f.rows.get(id).stripe_account='acct_other';
    await expect(f.store.consume(id)).rejects.toThrow(/Unable to decrypt/);
    expect(await f.store.consume(id)).toBeNull();
  });
  it('rejects swapped encryption key and non-compatible AAD without fallback to plaintext', async () => {
    const f=fixture();
    const {id}=await f.store.issue({kind:'api',secret:'unimportant-test-data'});
    const other=createOneTimeSecretStore({...f.adapters,encryptionKey:randomBytes(32)});
    await expect(other.consume(id)).rejects.toThrow(/Unable to decrypt/);
    const {id:second}=await f.store.issue({kind:'api',secret:'another-value'});
    const changed=createOneTimeSecretStore({...f.adapters,
      contextFor:({id,account,mode,kind})=>['new-prefix',id,account||'',mode||'',kind].join('/')});
    await expect(changed.consume(second)).rejects.toThrow(/Unable to decrypt/);
  });
  it('refuses invalid setup route/context before any storage or secret leak', async () => {
    const f=fixture();
    for (const route of ['https://evil.test/a','//evil.test','/a#fragment','']) {
      const store=createOneTimeSecretStore({...f.adapters,setupPathFor:()=>route});
      await expect(store.issue({kind:'api',secret:'fixture'})).rejects.toThrow(/route/);
    }
    const bad=createOneTimeSecretStore({...f.adapters,contextFor:()=>''});
    await expect(bad.issue({kind:'api',secret:'fixture'})).rejects.toThrow(/context/);
    expect(f.db.addOneTimeSecret).not.toHaveBeenCalled();
    await expect(f.store.issue({kind:'',secret:'fixture'})).rejects.toThrow(/required/);
  });
  it('binds each issuance route to its opaque id and denies path/authority escapes',async()=>{
    const f=fixture();
    for(const route of ['/api/stripe/setup?show=other', '/api/../admin?show=id',
      '/api/%2e%2e/admin?show=id', '/api/%2Fhidden?show=id',
      '/api\\evil?show=id', '/api//hidden?show=id']){
      const store=createOneTimeSecretStore({...f.adapters,
        setupPathFor:id=>route.replaceAll('id',id)});
      await expect(store.issue({kind:'setup',secret:'synthetic-data'})).rejects.toThrow(/route/);
    }
    expect(f.db.addOneTimeSecret).not.toHaveBeenCalled();
    // Real source's single-use query convention remains compatible.
    const successful=await f.store.issue({kind:'setup',secret:'fixture-data'});
    expect(successful.setupPath).toBe('/api/stripe/setup?show='+successful.id);
  });
  it('requires one exact issued identifier in a path segment or query value', async () => {
    const f=fixture();
    const invalid=[
      id=>'/api/stripe/setup?show=prefix'+id,
      id=>'/api/stripe/setup?show='+id+'suffix',
      id=>'/api/stripe/setup?'+id+'=anything',
      id=>'/api/stripe/setup/'+id+'suffix',
      id=>'/api/stripe/setup?x='+id+'&show='+id,
      id=>'/api/stripe/setup/'+id+'?show='+id,
      id=>'/api/stripe/setup?show=other&message='+id+'suffix'
    ];
    for (const setupPathFor of invalid) {
      const store=createOneTimeSecretStore({...f.adapters,setupPathFor});
      await expect(store.issue({kind:'setup',secret:'synthetic-value'})).rejects.toThrow(/route/);
    }
    expect(f.db.addOneTimeSecret).not.toHaveBeenCalled();
    const pathBound=createOneTimeSecretStore({
      ...f.adapters,setupPathFor:id=>'/api/stripe/setup/'+id
    });
    const {id,setupPath}=await pathBound.issue({kind:'setup',secret:'synthetic-value'});
    expect(setupPath).toBe('/api/stripe/setup/'+id);
    expect(await pathBound.consume(id)).toBe('synthetic-value');
  });
  it('refuses missing durability, missing AAD mappings or an unconfigured key', () => {
    const f=fixture();
    expect(()=>createOneTimeSecretStore({...f.adapters,db:{}})).toThrow(/Durable/);
    expect(()=>createOneTimeSecretStore({...f.adapters,contextFor:null})).toThrow(/bindings/);
    expect(()=>createOneTimeSecretStore({...f.adapters,encryptionKey:null})).toThrow(/32-byte/);
  });
  it('propagates a durable store failure without reporting successful issuance', async () => {
    const f=fixture();
    f.db.addOneTimeSecret.mockRejectedValueOnce(new Error('test DB unavailable'));
    await expect(f.store.issue({kind:'api',secret:'synthetic-data'})).rejects.toThrow(/DB unavailable/);
    expect(f.received).toHaveLength(0);
  });
});
