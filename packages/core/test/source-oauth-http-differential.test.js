// Run verified original Stripe OAuth HTTP runtime against the portable protocol
// under equivalent isolated server-storage contracts. Owner login UI remains
// source-service owned, not copied into a portable authorization grant.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe,expect,it,vi} from 'vitest';
import {gitBlobSha} from '../../../scripts/check-original-assertion-bodies.mjs';
import {createOAuthHandlers} from '../../../docs/audits/upstream/runtime/oauth-handlers.js';
import {createOAuthProtocolHandlers} from '../src/oauth-protocol.js';
import {hashToken} from '../src/oauth.js';

const origin='https://stripe-fake.example.test',callback='https://agent.example.test/cb';
const resource=origin+'/api/mcp',verifier='a'.repeat(43);
const challenge=createHash('sha256').update(verifier).digest('base64url');
const req=(method,body={})=>({method,body,query:body,headers:{'content-type':'application/json'},
  socket:{remoteAddress:'192.0.2.10'}});
function res(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  send(s){this.body=s;return this;},
  end(){return this;}
};}
async function call(method,fn,body={}) {
  const out=res();
  await fn(req(method,body),out);
  return {status:out.statusCode,body:typeof out.body==='string'&&
    (out.headers['Content-Type']||'').includes('json')?JSON.parse(out.body):out.body,
    headers:out.headers};
}
function fixture(){
  const clients=new Map(),codes=new Map(),access=new Map(),refresh=new Map();
  const db={
    createOAuthClient:vi.fn(async row=>clients.set(row.clientId,{
      client_id:row.clientId,client_secret_hash:hashToken(row.clientSecret),
      redirect_uris:row.redirectUris,client_name:row.clientName
    })),
    getOAuthClient:vi.fn(async id=>clients.get(id)||null),
    consumeAuthCode:vi.fn(async code=>{
      const item=codes.get(code)||null;codes.delete(code);return item;
    }),
    createAccessToken:vi.fn(async row=>{
      access.set(row.accessToken,row);refresh.set(row.refreshToken,row);
    }),
    rotateRefreshToken:vi.fn(async ({refreshToken,clientId,accessToken,newRefreshToken})=>{
      const old=refresh.get(refreshToken);
      if(!old||old.clientId!==clientId)return null;
      refresh.delete(refreshToken);access.delete(old.accessToken);
      const next={...old,accessToken,refreshToken:newRefreshToken,clientId};
      refresh.set(newRefreshToken,next);access.set(accessToken,next);
      return {accessToken,refreshToken:newRefreshToken,clientId};
    }),
    listStripeAccounts:vi.fn(async()=>[{id:'acct_fixture',label:'Escaped <account>'}])
  };
  const env={PUBLIC_BASE_URL:origin};
  const buildAccessRow=({accessToken,refreshToken,clientId,grant})=>({
    accessToken,refreshToken,clientId,stripeAccount:grant.stripe_account,
    mode:grant.mode,profile:grant.profile,listing:grant.listing
  });
  const upstream=createOAuthHandlers({db,env});
  const portable=createOAuthProtocolHandlers({db,env,buildAccessRow});
  const grant=client=>{
    const code='code-'+Math.random().toString(36).slice(2);
    codes.set(code,{client_id:client.client_id,redirect_uri:callback,
      code_challenge:challenge,code_challenge_method:'S256',
      stripe_account:'acct_fixture',mode:'test',profile:'full',listing:'compact'});
    return code;
  };
  const register=async h=>{
    const x=await call('POST',h.register,{redirect_uris:[callback],client_name:'Client'});
    expect(x.status).toBe(201);return x.body;
  };
  const tokenArgs=(client,code)=>({grant_type:'authorization_code',client_id:client.client_id,
    client_secret:client.client_secret,redirect_uri:callback,code_verifier:verifier,code,resource});
  return {db,upstream,portable,clients,codes,access,refresh,grant,register,tokenArgs};
}
describe('source OAuth HTTP vs transport-free protocol compatibility',()=>{
  it('pins the complete original executable OAuth handler and primitive Git blobs',()=>{
    for(const [name,digest] of [
      ['oauth-handlers.js','3aa62cf055e28dc4fcda6affa3a52dc0381be94e'],
      ['oauth.js','2e2fa72529869d7f2320661a641cdaa1d5de9841']]){
      const path=fileURLToPath(new URL('../../../docs/audits/upstream/runtime/'+name,import.meta.url));
      expect(gitBlobSha(readFileSync(path,'utf8'))).toBe(digest);
    }
  });
  it('matches original fixed HTTPS OAuth and protected-resource metadata exactly',async()=>{
    const f=fixture();
    // The original immutable source declares POST only. Modern Stripe source
    // additionally advertises Basic and public PKCE, an intentional adaptation.
    expect(await call('GET',f.portable.resourceMetadata))
      .toEqual(await call('GET',f.upstream.resourceMetadata));
    for(const name of ['metadata','resourceMetadata']){
      const post=await call('POST',f.portable[name]);
      expect(post).toEqual(await call('POST',f.upstream[name]));
      expect(post.status).toBe(405);
    }
    const metadata=(await call('GET',f.upstream.metadata)).body;
    const portable=(await call('GET',f.portable.metadata)).body;
    expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    expect(metadata.token_endpoint_auth_methods_supported).toEqual(['client_secret_post']);
    expect(portable).toMatchObject({issuer:metadata.issuer,
      token_endpoint:metadata.token_endpoint,
      code_challenge_methods_supported:['S256'],
      token_endpoint_auth_methods_supported:['client_secret_post','client_secret_basic','none']});
  });
  it('matches malformed/unsafe client registration HTTP rejection without persisting clients',async()=>{
    for(const input of [
      {redirect_uris:[]},{redirect_uris:['http://unsafe.example.test/cb']},
      {redirect_uris:[callback,callback]},
      {redirect_uris:[callback+'#fragment']},
      {redirect_uris:'not-an-array'}
    ]){
      const a=fixture(),b=fixture();
      expect(await call('POST',a.portable.register,input))
        .toEqual(await call('POST',b.upstream.register,input));
      expect(a.db.createOAuthClient).not.toHaveBeenCalled();
      expect(b.db.createOAuthClient).not.toHaveBeenCalled();
    }
  });
  it('retains original invalid-method denial while documenting adapted modern response',async()=>{
    const invalid={redirect_uris:[callback],token_endpoint_auth_method:'unrecognized'};
    const old=fixture(),next=fixture();
    const source=await call('POST',old.upstream.register,invalid);
    const portable=await call('POST',next.portable.register,invalid);
    expect(source.status).toBe(400);
    expect(source.body).toMatchObject({error:'invalid_client_metadata',
      error_description:'Only client_secret_post is supported'});
    expect(portable.status).toBe(400);
    expect(portable.body).toMatchObject({error:'invalid_client_metadata',
      error_description:'Unsupported client authentication'});
    expect(old.db.createOAuthClient).not.toHaveBeenCalled();
    expect(next.db.createOAuthClient).not.toHaveBeenCalled();
  });
  it('keeps source registration response schema and client secret private from later reads',async()=>{
    const f=fixture();
    for(const h of [f.upstream,f.portable]){
      const client=await f.register(h);
      expect(client.token_endpoint_auth_method).toBe('client_secret_post');
      expect(client.grant_types).toEqual(['authorization_code','refresh_token']);
      expect(client.client_secret.length).toBeGreaterThan(32);
      expect(JSON.stringify([...f.clients.values()])).not.toContain(client.client_secret);
    }
    expect(f.clients.size).toBe(2);
  });
  it('matches wrong resource, unauthorized client and unsupported grant status/envelopes',async()=>{
    for(const change of [
      {resource:'https://wrong.example.test/api/mcp'},
      {client_secret:'not-the-client-secret'},
      {grant_type:'password'}
    ]) {
      const a=fixture(),b=fixture();
      const aClient=await a.register(a.portable),bClient=await b.register(b.upstream);
      const inputA={...a.tokenArgs(aClient,'unused'),...change};
      const inputB={...b.tokenArgs(bClient,'unused'),...change};
      const x=await call('POST',a.portable.token,inputA);
      const y=await call('POST',b.upstream.token,inputB);
      expect({status:x.status,body:x.body}).toEqual({status:y.status,body:y.body});
      expect(a.db.createAccessToken).not.toHaveBeenCalled();
      expect(b.db.createAccessToken).not.toHaveBeenCalled();
    }
  });
  it('issues source-compatible scoped access claims and denies authorization-code replay',async()=>{
    for(const name of ['upstream','portable']){
      const f=fixture(),client=await f.register(f[name]);
      const code=f.grant(client),args=f.tokenArgs(client,code);
      const issued=await call('POST',f[name].token,args);
      expect(issued.status).toBe(200);
      expect(issued.body.token_type).toBe('Bearer');
      expect(issued.body.expires_in).toBe(3600);
      expect(f.access.get(issued.body.access_token)).toMatchObject({
        stripeAccount:'acct_fixture',mode:'test',profile:'full',listing:'compact'});
      expect((await call('POST',f[name].token,args)).body.error).toBe('invalid_grant');
      expect(f.db.createAccessToken).toHaveBeenCalledTimes(1);
    }
  });
  it('preserves source refresh grant response and refuses replay after rotating once',async()=>{
    for(const name of ['upstream','portable']){
      const f=fixture(),client=await f.register(f[name]);
      const issued=(await call('POST',f[name].token,f.tokenArgs(client,f.grant(client)))).body;
      const input={grant_type:'refresh_token',client_id:client.client_id,
        client_secret:client.client_secret,refresh_token:issued.refresh_token,resource};
      const renewed=await call('POST',f[name].token,input);
      expect(renewed.status).toBe(200);
      expect(renewed.body.token_type).toBe('Bearer');
      expect(renewed.body.expires_in).toBe(3600);
      expect(f.access.get(renewed.body.access_token)).toMatchObject({
        stripeAccount:'acct_fixture',mode:'test',profile:'full',listing:'compact'});
      expect(f.access.has(issued.access_token)).toBe(false);
      const replay=await call('POST',f[name].token,input);
      expect(replay.status).toBe(400);
      expect(replay.body.error).toBe('invalid_grant');
    }
  });
  it('keeps source owner authorization UI and account selection outside the portable export',async()=>{
    const f=fixture(),client=await f.register(f.upstream);
    const p={client_id:client.client_id,redirect_uri:callback,response_type:'code',
      code_challenge:challenge,code_challenge_method:'S256',resource};
    const page=await call('GET',f.upstream.authorize,p);
    expect(page.status).toBe(200);
    expect(page.body).toContain('&lt;account&gt;');
    expect(f.portable).not.toHaveProperty('authorize');
    expect(f.db.createAccessToken).not.toHaveBeenCalled();
  });
});
