// Execute upstream Stripe source modules alongside portable adapters using
// only disposable in-memory service bindings. No Stripe SDK or production APIs.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { gitBlobSha } from '../../../scripts/check-original-assertion-bodies.mjs';
import { requireMcpToken } from '../../../docs/audits/upstream/runtime/mcp-auth.js';
import { createOneTimeStore } from '../../../docs/audits/upstream/runtime/one-time-secrets.js';
import { createMcpBearerAuthenticator } from '../src/mcp-auth.js';
import { createOneTimeSecretStore } from '../src/one-time-secrets.js';

const origin='https://owner.test.example';
const bearer='B'.repeat(32);
const valid={
  client_id:'client-1',stripe_account:'acct_fixture',mode:'test',
  profile:'read_only',listing:'compact',result_scope:'result-scope-1'
};
function response(){
  return {statusCode:null,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(c){this.statusCode=c;return this;},
    send(text){this.body=JSON.parse(text);return this;}
  };
}
function authenticators(record){
  const getAccessToken=vi.fn(async()=>record);
  const original=(req,res)=>requireMcpToken(req,res,{getAccessToken},{PUBLIC_BASE_URL:origin});
  const adapted=createMcpBearerAuthenticator({
    getAccessToken,
    env:{PUBLIC_BASE_URL:origin},
    projectConnection:row=>row.mode==='test'&&
      ['read_only','everyday','full'].includes(row.profile)&&
      ['catalog','compact'].includes(row.listing)?
      {clientId:row.client_id,stripeAccount:row.stripe_account,mode:row.mode,
        profile:row.profile,listing:row.listing,resultScope:row.result_scope}:null
  });
  return {original,adapted,getAccessToken};
}
function storeFixture(){
  const rows=new Map(),key=randomBytes(32);
  const db={
    addOneTimeSecret:vi.fn(async row=>{
      rows.set(row.id,{...row,stripe_account:row.account});
    }),
    consumeOneTimeSecret:vi.fn(async id=>{
      const row=rows.get(id);
      if(!row||row.expiresAt.getTime()<=Date.now())return null;
      rows.delete(id);
      return row;
    })
  };
  const source=createOneTimeStore({db,encryptionKey:key});
  const adapted=createOneTimeSecretStore({
    db,encryptionKey:key,
    contextFor:({id,account,mode,kind})=>
      ['stripe-once',id,account||'',mode||'',kind].join('/'),
    setupPathFor:id=>'/api/stripe/setup?show='+encodeURIComponent(id),
    accountFromRow:row=>row.stripe_account
  });
  return {source,adapted,rows,db,key};
}
describe('direct upstream source vs portable adapter compatibility',()=>{
  it('verifies exact upstream runtime Git blob snapshots before executing them',()=>{
    const expected=[
      ['mcp-auth.js','eea535069b2179dfa74ed4ad101abacd5789dea0'],
      ['one-time-secrets.js','071900c19db7d77a608c7bb65574b12b24c080fb'],
      ['crypto.js','34dce85cd4ca32553bfa2512778e68f819558de5'],
      ['http.js','1b2078afb1bccbb576bfb493c623067871866b7f']
    ];
    for(const [name,sha] of expected){
      const url=new URL('../../../docs/audits/upstream/runtime/'+name,import.meta.url);
      expect(gitBlobSha(readFileSync(fileURLToPath(url),'utf8'))).toBe(sha);
    }
  });
  it('matches source bearer response envelope, status and challenge for malformed input',async()=>{
    const f=authenticators(valid);
    for(const authorization of [undefined,'Basic '+bearer,'Bearer tiny',
      'bearer '+bearer,'Bearer '+bearer+'$', 'Bearer '+bearer+' ']){
      const req={headers:{authorization}},a=response(),b=response();
      expect(await f.original(req,a)).toBeNull();
      expect(await f.adapted(req,b)).toBeNull();
      expect({status:a.statusCode,headers:a.headers,body:a.body})
        .toEqual({status:b.statusCode,headers:b.headers,body:b.body});
    }
    expect(f.getAccessToken).not.toHaveBeenCalled();
  });
  it('matches upstream invalid-token responses for revoked or forbidden durable rows',async()=>{
    for(const record of [null,{...valid,profile:'operator'},
      {...valid,listing:'internal'},{...valid,mode:'live'}]){
      const f=authenticators(record),req={headers:{authorization:'Bearer '+bearer}};
      const a=response(),b=response();
      expect(await f.original(req,a)).toBeNull();
      expect(await f.adapted(req,b)).toBeNull();
      expect({status:a.statusCode,headers:a.headers,body:a.body})
        .toEqual({status:b.statusCode,headers:b.headers,body:b.body});
    }
  });
  it('returns only the same valid source-scoped claims with no bearer in identity',async()=>{
    const f=authenticators(valid),req={headers:{authorization:'Bearer '+bearer}};
    const a=response(),b=response();
    const sourceClaims=await f.original(req,a),adaptedClaims=await f.adapted(req,b);
    expect(adaptedClaims).toEqual(sourceClaims);
    expect(Object.isFrozen(adaptedClaims)).toBe(true);
    expect(JSON.stringify(adaptedClaims)).not.toContain(bearer);
    expect(a.body).toBeNull();
    expect(b.body).toBeNull();
  });
  it('decrypts the original service ciphertext through the portable AAD adapter once',async()=>{
    const f=storeFixture(),secret='not-a-real-credential';
    const issued=await f.source.issue({account:'acct_example',kind:'webhook-signing-secret',secret});
    expect(issued.id).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(issued.setupPath).toBe('/api/stripe/setup?show='+issued.id);
    expect(JSON.stringify(f.rows.get(issued.id))).not.toContain(secret);
    expect(await f.adapted.consume(issued.id)).toBe(secret);
    expect(await f.source.consume(issued.id)).toBeNull();
  });
  it('decrypts portable ciphertext through the original source service using unchanged AAD',async()=>{
    const f=storeFixture(),secret='non-secret-fixture-value';
    const issued=await f.adapted.issue({account:'acct_example',mode:'test',kind:'setup',secret});
    expect(issued.setupPath).toBe('/api/stripe/setup?show='+issued.id);
    expect(await f.source.consume(issued.id)).toBe(secret);
    expect(await f.adapted.consume(issued.id)).toBeNull();
  });
  it('fails closed for changed source account or context and does not reveal plaintext',async()=>{
    const f=storeFixture();
    const original=await f.source.issue({account:'acct_original',kind:'setup',secret:'fixture'});
    f.rows.get(original.id).stripe_account='acct_other';
    await expect(f.adapted.consume(original.id)).rejects.toThrow(/Unable to decrypt/);
    expect(await f.source.consume(original.id)).toBeNull();
    const second=await f.adapted.issue({account:'acct_original',kind:'setup',secret:'fixture'});
    f.rows.get(second.id).stripe_account='acct_other';
    await expect(f.source.consume(second.id)).rejects.toThrow(/Unable to decrypt/);
  });
});
