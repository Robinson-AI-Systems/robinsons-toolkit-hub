import {describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createOAuthProtocolHandlers} from '../src/oauth-protocol.js';
import {hashToken} from '../src/oauth.js';

const env={PUBLIC_BASE_URL:'https://provider.example.test'};
const callback='https://agent.example.test/cb';
const verifier='x'.repeat(43), challenge=createHash('sha256').update(verifier).digest('base64url');
function response() {
  return {statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(c){this.statusCode=c;return this;},
    send(v){this.body=v;return this;}};
}
function req(method,body) {
  return {method,headers:{'content-type':'application/json'},body};
}
async function call(fn,method,body) {
  const res=response();await fn(req(method,body),res);return {status:res.statusCode,headers:res.headers,
    value:JSON.parse(res.body)};
}
function fixture() {
  const clients=new Map(),codes=new Map(),tokens=new Map(),refreshes=new Map();
  const db={
    createOAuthClient:vi.fn(async ({clientId,clientSecret,redirectUris,clientName})=>
      clients.set(clientId,{client_id:clientId,client_secret_hash:hashToken(clientSecret),
        redirect_uris:redirectUris,client_name:clientName})),
    getOAuthClient:vi.fn(async id=>clients.get(id)),
    consumeAuthCode:vi.fn(async id=>{const v=codes.get(id);codes.delete(id);return v;}),
    createAccessToken:vi.fn(async row=>{tokens.set(row.accessToken,row);
      refreshes.set(row.refreshToken,row);}),
    rotateRefreshToken:vi.fn(async ({refreshToken,clientId,accessToken,newRefreshToken})=>{
      const old=refreshes.get(refreshToken);
      if(!old||old.clientId!==clientId)return null;
      refreshes.delete(refreshToken);
      const next={...old,accessToken,refreshToken:newRefreshToken};
      tokens.set(accessToken,next);refreshes.set(newRefreshToken,next);return next;
    })
  };
  const buildAccessRow=vi.fn(({grant,...base})=>({...base,tenant:grant.tenant,
    profile:grant.profile,mode:grant.mode,listing:grant.listing}));
  const handlers=createOAuthProtocolHandlers({db,env,buildAccessRow});
  return {db,codes,tokens,refreshes,buildAccessRow,handlers};
}
async function registered(f) {
  const a=await call(f.handlers.register,'POST',{redirect_uris:[callback],client_name:'Test Agent'});
  expect(a.status).toBe(201);
  return a.value;
}
describe('portable OAuth protocol handlers',()=>{
  it('publishes fixed HTTPS RFC metadata and local resource without Host dependence', async()=>{
    const f=fixture();
    const a=await call(f.handlers.metadata,'GET',{});
    expect(a.value).toMatchObject({issuer:env.PUBLIC_BASE_URL,code_challenge_methods_supported:['S256']});
    expect(a.value.token_endpoint).toBe(env.PUBLIC_BASE_URL+'/api/oauth/token');
    const b=await call(f.handlers.resourceMetadata,'GET',{});
    expect(b.value.resource).toBe(env.PUBLIC_BASE_URL+'/api/mcp');
    expect(b.value.authorization_servers).toEqual([env.PUBLIC_BASE_URL]);
    expect(f.db.getOAuthClient).not.toHaveBeenCalled();
  });
  it('rejects insecure, duplicate and too many redirect URIs, and unsupported auth', async()=>{
    const f=fixture();
    for(const uris of [['http://evil.test/cb'],[callback,callback],[],Array(9).fill(callback)]) {
      const a=await call(f.handlers.register,'POST',{redirect_uris:uris});
      expect(a.status).toBe(400);
      expect(a.value.error).toBe('invalid_client_metadata');
    }
    expect((await call(f.handlers.register,'POST',{redirect_uris:[callback],
      token_endpoint_auth_method:'none'})).status).toBe(400);
    expect(f.db.createOAuthClient).not.toHaveBeenCalled();
  });
  it('registers hashed storage via service, never returns storage hash to the caller',async()=>{
    const f=fixture();
    const v=await registered(f);
    expect(v.token_endpoint_auth_method).toBe('client_secret_post');
    expect(v.client_secret).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(f.db.createOAuthClient).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(v)).not.toContain('client_secret_hash');
  });
  it('auth-code grant validates client, redirect, PKCE and exact resource, then maps claims',async()=>{
    const f=fixture(),c=await registered(f);
    const grant={client_id:c.client_id,redirect_uri:callback,code_challenge:challenge,
      code_challenge_method:'S256',tenant:'tenant-1',profile:'read_only',mode:'test',listing:'compact'};
    f.codes.set('code_1',grant);
    const args={grant_type:'authorization_code',client_id:c.client_id,client_secret:c.client_secret,
      redirect_uri:callback,code:'code_1',code_verifier:verifier,resource:env.PUBLIC_BASE_URL+'/api/mcp'};
    expect((await call(f.handlers.token,'POST',{...args,resource:'https://evil.test/api/mcp'})).value.error).toBe('invalid_target');
    expect(f.codes.has('code_1')).toBe(true);
    const a=await call(f.handlers.token,'POST',args);
    expect(a.status).toBe(200);
    expect(a.value.expires_in).toBe(3600);
    expect(f.db.createAccessToken).toHaveBeenCalledTimes(1);
    expect(f.tokens.get(a.value.access_token)).toMatchObject({tenant:'tenant-1',
      mode:'test',profile:'read_only',listing:'compact'});
    expect((await call(f.handlers.token,'POST',args)).value.error).toBe('invalid_grant');
  });
  it('rejects invalid client credentials, wrong redirect, incorrect verifier and unknown grant',async()=>{
    const f=fixture(),c=await registered(f);
    const base={grant_type:'authorization_code',client_id:c.client_id,client_secret:'wrong',
      redirect_uri:callback,code:'x',code_verifier:verifier,resource:env.PUBLIC_BASE_URL+'/api/mcp'};
    expect((await call(f.handlers.token,'POST',base)).value.error).toBe('invalid_client');
    expect((await call(f.handlers.token,'POST',{...base,client_secret:c.client_secret,
      redirect_uri:'https://evil.test'})).value.error).toBe('invalid_grant');
    expect((await call(f.handlers.token,'POST',{...base,client_secret:c.client_secret,
      grant_type:'password'})).value.error).toBe('unsupported_grant_type');
    expect(f.db.createAccessToken).not.toHaveBeenCalled();
  });
  it('never persists active or mismatched access row mappings after grant consumption',async()=>{
    const f=fixture(),c=await registered(f);
    let sequence=0;
    const issue=async(build)=>{
      const code='code_'+(++sequence);
      f.codes.set(code,{client_id:c.client_id,redirect_uri:callback,code_challenge:challenge,
        code_challenge_method:'S256',tenant:'tenant-1',profile:'read_only',mode:'test'});
      f.buildAccessRow.mockImplementationOnce(build);
      const outcome=await call(f.handlers.token,'POST',{
        grant_type:'authorization_code',client_id:c.client_id,client_secret:c.client_secret,
        redirect_uri:callback,code,code_verifier:verifier,resource:env.PUBLIC_BASE_URL+'/api/mcp'});
      expect(outcome.status).toBe(400);
      expect(outcome.value.error).toBe('invalid_grant');
    };
    let getterCalls=0;
    await issue(({grant,...base})=>{
      const row={...base,tenant:grant.tenant};
      Object.defineProperty(row,'accessToken',{enumerable:true,get(){
        getterCalls++;throw Error('private access secret');}});
      return row;
    });
    await issue(({grant,...base})=>({...base,clientId:'different',tenant:grant.tenant}));
    await issue(({grant: _grant,...base})=>Object.assign(Object.create({inherited:true}),base));
    expect(getterCalls).toBe(0);
    expect(f.db.createAccessToken).not.toHaveBeenCalled();
  });
  it('deep-snapshots owner-selected OAuth claims before creating any durable bearer', async()=>{
    const f=fixture(),c=await registered(f);
    const nested={roles:['viewer'],settings:{listing:'compact'}};
    const date=new Date('2026-10-11T00:00:00.000Z');
    f.codes.set('nested-code',{client_id:c.client_id,redirect_uri:callback,
      code_challenge:challenge,code_challenge_method:'S256',profile:'read_only',mode:'test'});
    f.buildAccessRow.mockImplementationOnce(({grant: _grant,...tokens})=>
      ({...tokens,profile:'read_only',mode:'test',nested,date}));
    const answer=await call(f.handlers.token,'POST',{
      grant_type:'authorization_code',client_id:c.client_id,client_secret:c.client_secret,
      redirect_uri:callback,code:'nested-code',code_verifier:verifier,
      resource:env.PUBLIC_BASE_URL+'/api/mcp'});
    expect(answer.status).toBe(200);
    const saved=f.tokens.get(answer.value.access_token);
    expect(saved.nested).not.toBe(nested);
    expect(saved.nested.roles).not.toBe(nested.roles);
    expect(Object.isFrozen(saved.nested.settings)).toBe(true);
    expect(saved.date).not.toBe(date);
    nested.roles.push('owner');
    nested.settings.listing='expanded';
    date.setFullYear(2040);
    expect(saved.nested).toEqual({roles:['viewer'],settings:{listing:'compact'}});
    expect(saved.date.toISOString()).toBe('2026-10-11T00:00:00.000Z');
  });
  it('rejects nested active, cyclic and oversized service credential claims without calling SQL',async()=>{
    const f=fixture(),c=await registered(f);
    let executed=0;
    const active={};
    Object.defineProperty(active,'role',{enumerable:true,get(){executed++;return 'owner';}});
    const cyclic={};cyclic.self=cyclic;
    for (const value of [active,cyclic,Array(260).fill('x')]) {
      const code='unsafe-'+f.db.consumeAuthCode.mock.calls.length;
      f.codes.set(code,{client_id:c.client_id,redirect_uri:callback,
        code_challenge:challenge,code_challenge_method:'S256',mode:'test'});
      f.buildAccessRow.mockImplementationOnce(({grant: _grant,...tokens})=>({...tokens,extra:value}));
      const outcome=await call(f.handlers.token,'POST',{
        grant_type:'authorization_code',client_id:c.client_id,client_secret:c.client_secret,
        redirect_uri:callback,code,code_verifier:verifier,
        resource:env.PUBLIC_BASE_URL+'/api/mcp'});
      expect(outcome).toMatchObject({status:400,value:{error:'invalid_grant'}});
    }
    expect(executed).toBe(0);
    expect(f.db.createAccessToken).not.toHaveBeenCalled();
  });
  it('does not return bearer credentials when the rotated SQL receipt has active fields',async()=>{
    const f=fixture(),c=await registered(f);
    let getterCalls=0;
    f.db.rotateRefreshToken.mockImplementationOnce(async()=>{
      const row={accessToken:'not-the-issued-access',clientId:c.client_id};
      Object.defineProperty(row,'refreshToken',{enumerable:true,get(){
        getterCalls++;throw Error('private SQL value');}});
      return row;
    });
    const outcome=await call(f.handlers.token,'POST',{
      grant_type:'refresh_token',client_id:c.client_id,client_secret:c.client_secret,
      refresh_token:'synthetic-refresh',resource:env.PUBLIC_BASE_URL+'/api/mcp'});
    expect(outcome.status).toBe(400);
    expect(outcome.value.error).toBe('invalid_grant');
    expect(getterCalls).toBe(0);
  });
  it('refresh rotates exactly once and retains service claim settings in durable store',async()=>{
    const f=fixture(),c=await registered(f);
    const original={clientId:c.client_id,tenant:'tenant-2',profile:'full',listing:'compact',mode:'test',
      accessToken:'issued-access',refreshToken:'issued-refresh'};
    await f.db.createAccessToken(original);
    const args={grant_type:'refresh_token',client_id:c.client_id,client_secret:c.client_secret,
      refresh_token:'issued-refresh',resource:env.PUBLIC_BASE_URL+'/api/mcp'};
    const a=await call(f.handlers.token,'POST',args);
    expect(a.status).toBe(200);
    expect(f.tokens.get(a.value.access_token)).toMatchObject({
      tenant:'tenant-2',profile:'full',listing:'compact',mode:'test'});
    expect((await call(f.handlers.token,'POST',args)).value.error).toBe('invalid_grant');
    expect(f.db.rotateRefreshToken).toHaveBeenCalledTimes(2);
  });
  it('refuses duplicate form selectors and unsafe OAuth request descriptors before service SQL', async()=>{
    const f=fixture();
    async function raw(handler, body, type='application/x-www-form-urlencoded') {
      const res=response();
      await handler({method:'POST',headers:{'content-type':type},body},res);
      return {status:res.statusCode,value:JSON.parse(res.body)};
    }
    for (const body of [
      'resource=https%3A%2F%2Fprovider.example.test%2Fapi%2Fmcp&client_id=a&client_id=b',
      'client_id=a&%63lient_id=b',
      'grant_type=refresh_token&grant_type=authorization_code',
      'redirect_uris=x&redirect_uris=y'
    ]) {
      const response=await raw(f.handlers.token,body);
      expect(response).toMatchObject({status:400,value:{error:'invalid_request'}});
    }
    let executed=0;
    const active={};
    Object.defineProperty(active,'resource',{enumerable:true,get(){executed++;return 'bad';}});
    expect((await raw(f.handlers.token,active,'application/json')).status).toBe(400);
    expect(executed).toBe(0);
    const inherited=Object.create({resource:env.PUBLIC_BASE_URL+'/api/mcp'});
    expect((await raw(f.handlers.token,inherited,'application/json')).status).toBe(400);
    const polluted=JSON.parse('{"__proto__":{"resource":"bad"}}');
    expect((await raw(f.handlers.token,polluted,'application/json')).status).toBe(400);
    const redirects=[callback];
    Object.defineProperty(redirects,'0',{enumerable:true,get(){executed++;return callback;}});
    const invalid=await raw(f.handlers.register,{redirect_uris:redirects},'application/json');
    expect(invalid).toMatchObject({status:400,value:{error:'invalid_client_metadata'}});
    expect(executed).toBe(0);
    expect(f.db.getOAuthClient).not.toHaveBeenCalled();
    expect(f.db.createOAuthClient).not.toHaveBeenCalled();
    expect(f.db.consumeAuthCode).not.toHaveBeenCalled();
    expect(f.db.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('rejects exotic redirect arrays and snapshots service mutations independently of responses', async()=>{
    const f=fixture();
    const extra=[callback];
    Object.defineProperty(extra,'hidden',{value:'service-owned',enumerable:false});
    const keyed=[callback];
    keyed.unexpected='data';
    const holed=[callback,'https://agent.example.test/other'];
    delete holed[1];
    for (const redirect_uris of [extra,keyed,holed]) {
      const denied=await call(f.handlers.register,'POST',{redirect_uris});
      expect(denied).toMatchObject({status:400,value:{error:'invalid_client_metadata'}});
    }
    expect(f.db.createOAuthClient).not.toHaveBeenCalled();
    const original=[callback];
    f.db.createOAuthClient.mockImplementationOnce(async ({redirectUris})=>{
      expect(redirectUris).not.toBe(original);
      redirectUris.push('https://mutated.example.test/cb');
    });
    const accepted=await call(f.handlers.register,'POST',{redirect_uris:original});
    expect(accepted.status).toBe(201);
    expect(accepted.value.redirect_uris).toEqual([callback]);
    expect(original).toEqual([callback]);
  });
  it('requires storage, claim mapping and safe local paths, not implicit service defaults',()=>{
    const f=fixture();
    expect(()=>createOAuthProtocolHandlers({db:{},env,buildAccessRow:()=>({})})).toThrow(/storage/);
    expect(()=>createOAuthProtocolHandlers({db:f.db,env})).toThrow(/mapping/);
    expect(()=>createOAuthProtocolHandlers({db:f.db,env,buildAccessRow:()=>({}),
      paths:{mcp:'https://unsafe.test'}})).toThrow(/paths/);
  });
});
