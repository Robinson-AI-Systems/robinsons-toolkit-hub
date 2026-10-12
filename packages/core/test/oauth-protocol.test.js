import {describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createOAuthProtocolHandlers,oauthTransportBodyWithinLimit,MAX_OAUTH_BODY_BYTES} from '../src/oauth-protocol.js';
import {hashToken} from '../src/oauth.js';

const env={PUBLIC_BASE_URL:'https://provider.example.test'};
const callback='https://agent.example.test/cb';
const verifier='x'.repeat(43), challenge=createHash('sha256').update(verifier).digest('base64url');
function response() {
  return {statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(c){this.statusCode=c;return this;},
    send(v){this.body=v;return this;},end(){this.ended=true;return this;}};
}
function req(method,body) {
  return {method,headers:{'content-type':'application/json'},body};
}
async function call(fn,method,body,headers={}) {
  const res=response();
  await fn({...req(method,body),headers:{...req(method,body).headers,...headers}},res);
  return {status:res.statusCode,headers:res.headers,value:JSON.parse(res.body)};
}
function fixture() {
  const clients=new Map(),codes=new Map(),tokens=new Map(),refreshes=new Map();
  const db={
    createOAuthClient:vi.fn(async ({clientId,clientSecret,redirectUris,clientName,tokenEndpointAuthMethod})=>
      clients.set(clientId,{client_id:clientId,
        client_secret_hash:clientSecret === null ? null : hashToken(clientSecret),
        token_endpoint_auth_method:tokenEndpointAuthMethod,
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
  return {db,clients,codes,tokens,refreshes,buildAccessRow,handlers};
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
      token_endpoint_auth_method:'client_credentials'})).status).toBe(400);
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
  it('rejects foreign, active and ambiguous client SQL rows before any code consume',async()=>{
    const f=fixture(),c=await registered(f);
    const base={grant_type:'authorization_code',client_id:c.client_id,client_secret:c.client_secret,
      redirect_uri:callback,code:'synthetic-code',code_verifier:verifier,
      resource:env.PUBLIC_BASE_URL+'/api/mcp'};
    let getterCalls=0;
    const getter={client_id:c.client_id,redirect_uris:[callback]};
    Object.defineProperty(getter,'client_secret_hash',{enumerable:true,
      get(){getterCalls++;return hashToken(c.client_secret);}});
    const activeRedirect={client_id:c.client_id,client_secret_hash:hashToken(c.client_secret)};
    Object.defineProperty(activeRedirect,'redirect_uris',{enumerable:true,
      get(){getterCalls++;return [callback];}});
    const wrong={client_id:'another-client',client_secret_hash:hashToken(c.client_secret),
      redirect_uris:[callback]};
    const unsafe=[callback]; unsafe.hidden=true;
    const ambiguous={client_id:c.client_id,client_secret_hash:hashToken(c.client_secret),
      redirect_uris:unsafe};
    for(const row of [getter,activeRedirect,wrong,ambiguous]) {
      f.db.getOAuthClient.mockResolvedValueOnce(row);
      const answer=await call(f.handlers.token,'POST',base);
      expect(answer).toMatchObject({status:401,value:{error:'invalid_client'}});
    }
    expect(getterCalls).toBe(0);
    expect(f.db.consumeAuthCode).not.toHaveBeenCalled();
    expect(f.db.createAccessToken).not.toHaveBeenCalled();
  });
  it('deep-snapshots consumed authorization code rows and refuses active claims',async()=>{
    const f=fixture(),c=await registered(f);
    const params=code=>({grant_type:'authorization_code',client_id:c.client_id,
      client_secret:c.client_secret,redirect_uri:callback,code,
      code_verifier:verifier,resource:env.PUBLIC_BASE_URL+'/api/mcp'});
    let getterCalls=0;
    const active={client_id:c.client_id,redirect_uri:callback,
      code_challenge_method:'S256',tenant:'tenant-one'};
    Object.defineProperty(active,'code_challenge',{enumerable:true,
      get(){getterCalls++;return challenge;}});
    f.db.consumeAuthCode.mockResolvedValueOnce(active);
    const denied=await call(f.handlers.token,'POST',params('active-code'));
    expect(denied).toMatchObject({status:400,value:{error:'invalid_grant'}});
    expect(getterCalls).toBe(0);
    expect(f.buildAccessRow).not.toHaveBeenCalled();
    const raw={client_id:c.client_id,redirect_uri:callback,code_challenge:challenge,
      code_challenge_method:'S256',tenant:'tenant-one',claims:{scope:['read']}};
    f.db.consumeAuthCode.mockResolvedValueOnce(raw);
    f.buildAccessRow.mockImplementationOnce(({grant,...issued})=>{
      expect(grant).not.toBe(raw);
      expect(Object.isFrozen(grant.claims.scope)).toBe(true);
      raw.tenant='different-account';
      raw.claims.scope.push('admin');
      return {...issued,tenant:grant.tenant,scope:grant.claims.scope};
    });
    const success=await call(f.handlers.token,'POST',params('valid-code'));
    expect(success.status).toBe(200);
    expect(f.tokens.get(success.value.access_token)).toMatchObject({
      tenant:'tenant-one',scope:['read']});
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
  it('registers explicit Basic and PKCE-only public clients with durable method-scoped SQL rows',async()=>{
    const f=fixture();
    const basic=await call(f.handlers.register,'POST',{redirect_uris:[callback],
      client_name:'Private basic',token_endpoint_auth_method:'client_secret_basic'});
    expect(basic.status).toBe(201);
    expect(basic.value.client_secret).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(f.clients.get(basic.value.client_id)).toMatchObject({
      token_endpoint_auth_method:'client_secret_basic',
      client_secret_hash:hashToken(basic.value.client_secret)
    });
    const pub=await call(f.handlers.register,'POST',{redirect_uris:[callback],
      token_endpoint_auth_method:'none'});
    expect(pub.status).toBe(201);
    expect(pub.value).not.toHaveProperty('client_secret');
    expect(f.clients.get(pub.value.client_id)).toMatchObject({
      token_endpoint_auth_method:'none',client_secret_hash:null
    });
    expect(f.db.createOAuthClient).toHaveBeenCalledTimes(2);
  });
  it('authorizes Basic clients with only canonical headers and exact grant/refresh bindings',async()=>{
    const f=fixture();
    const basic=(await call(f.handlers.register,'POST',{redirect_uris:[callback],
      token_endpoint_auth_method:'client_secret_basic'})).value;
    const auth='Basic '+Buffer.from(basic.client_id+':'+basic.client_secret).toString('base64');
    const code='basic-once';
    f.codes.set(code,{client_id:basic.client_id,redirect_uri:callback,code_challenge:challenge,
      code_challenge_method:'S256',tenant:'owned-tenant',profile:'read_only',
      mode:'test',listing:'compact'});
    const input={grant_type:'authorization_code',code,redirect_uri:callback,
      code_verifier:verifier,resource:env.PUBLIC_BASE_URL+'/api/mcp'};
    expect((await call(f.handlers.token,'POST',{...input,client_secret:basic.client_secret},
      {authorization:auth})).status).toBe(401);
    expect(f.codes.has(code)).toBe(true);
    const granted=await call(f.handlers.token,'POST',input,{authorization:auth});
    expect(granted.status).toBe(200);
    expect(f.tokens.get(granted.value.access_token)).toMatchObject({tenant:'owned-tenant',
      mode:'test',profile:'read_only'});
    const refresh=await call(f.handlers.token,'POST',{grant_type:'refresh_token',
      refresh_token:granted.value.refresh_token,resource:input.resource},{authorization:auth});
    expect(refresh.status).toBe(200);
    expect((await call(f.handlers.token,'POST',{grant_type:'refresh_token',
      refresh_token:granted.value.refresh_token,resource:input.resource},
      {authorization:auth})).value.error).toBe('invalid_grant');
  });
  it('enforces PKCE on public clients and refuses accidental confidential credentials',async()=>{
    const f=fixture();
    const pub=(await call(f.handlers.register,'POST',{redirect_uris:[callback],
      token_endpoint_auth_method:'none'})).value;
    const code='public-code';
    f.codes.set(code,{client_id:pub.client_id,redirect_uri:callback,code_challenge:challenge,
      code_challenge_method:'S256',tenant:'test-tenant',mode:'test',
      profile:'read_only',listing:'compact'});
    const input={grant_type:'authorization_code',client_id:pub.client_id,code,
      code_verifier:verifier,redirect_uri:callback,resource:env.PUBLIC_BASE_URL+'/api/mcp'};
    expect((await call(f.handlers.token,'POST',{...input,client_secret:'unwanted'})).status).toBe(401);
    expect((await call(f.handlers.token,'POST',{...input,code_verifier:'invalid'})).status).toBe(400);
    expect(f.codes.has(code)).toBe(false); // PKCE failure consumes code atomically.
    f.codes.set(code,{client_id:pub.client_id,redirect_uri:callback,code_challenge:challenge,
      code_challenge_method:'S256',tenant:'test-tenant',mode:'test',
      profile:'read_only',listing:'compact'});
    const good=await call(f.handlers.token,'POST',input);
    expect(good.status).toBe(200);
    expect(f.tokens.get(good.value.access_token).tenant).toBe('test-tenant');
  });
  it('denies conflicting, invalid and active Basic headers before code consumption',async()=>{
    const f=fixture();
    const client=(await call(f.handlers.register,'POST',{redirect_uris:[callback],
      token_endpoint_auth_method:'client_secret_basic'})).value;
    const input={grant_type:'authorization_code',client_id:client.client_id,
      resource:env.PUBLIC_BASE_URL+'/api/mcp',code:'still-unused',
      code_verifier:verifier,redirect_uri:callback};
    const credential=Buffer.from(client.client_id+':'+client.client_secret).toString('base64');
    const denied=['Bearer invalid','Basic '+credential.slice(0,-1),'Basic !!!',
      'basic '+Buffer.from('other-client:wrong').toString('base64')];
    for(const header of denied){
      const out=await call(f.handlers.token,'POST',input,{authorization:header});
      expect(out.status).toBe(401);
      expect(out.headers['WWW-Authenticate']).toMatch(/^Basic realm=/);
    }
    const header={};
    let invoked=0;
    Object.defineProperty(header,'authorization',{enumerable:true,get(){invoked++;return 'Basic '+credential;}});
    const res=response();
    await f.handlers.token({...req('POST',input),headers:header},res);
    expect(res.statusCode).toBe(401);
    expect(invoked).toBe(0);
    expect(f.db.consumeAuthCode).not.toHaveBeenCalled();
  });
  it('refuses malformed client method SQL metadata and conflicting registration fields',async()=>{
    const f=fixture();
    const badMetadata=[
      {client_name:'has\ncontrol'}, {client_name:42},
      {response_types:['token']},{grant_types:['refresh_token']},
      {grant_types:['authorization_code','authorization_code']},
      {redirect_uris:['https://agent.example.test/'+ 'x'.repeat(2100)]}
    ];
    for(const override of badMetadata){
      expect((await call(f.handlers.register,'POST',{
        redirect_uris:[callback],...override})).status).toBe(400);
    }
    expect(f.db.createOAuthClient).not.toHaveBeenCalled();
    const client=await registered(f);
    const data={grant_type:'authorization_code',client_id:client.client_id,
      client_secret:client.client_secret,resource:env.PUBLIC_BASE_URL+'/api/mcp',
      code:'never-consume',code_verifier:verifier,redirect_uri:callback};
    const row=f.clients.get(client.client_id);
    f.clients.set(client.client_id,{...row,token_endpoint_auth_method:'none'});
    expect((await call(f.handlers.token,'POST',data)).status).toBe(401);
    const active={...row};
    let called=0;
    Object.defineProperty(active,'token_endpoint_auth_method',{enumerable:true,
      get(){called++;return 'client_secret_post';}});
    f.clients.set(client.client_id,active);
    expect((await call(f.handlers.token,'POST',data)).status).toBe(401);
    expect(called).toBe(0);
    expect(f.db.consumeAuthCode).not.toHaveBeenCalled();
  });
});

describe('current source transport-byte evidence at portable OAuth boundary', () => {
  it('rejects oversized and ambiguous wire evidence without reading durable OAuth clients', async () => {
    const f=fixture();
    const bad = [
      {'content-length':'0003'}, {'content-length':'-3'},
      {'content-length':'99999999999999999999'},
      {'content-length':String(MAX_OAUTH_BODY_BYTES+1)}
    ];
    for (const headers of bad) {
      const result=await call(f.handlers.token,'POST',{resource:env.PUBLIC_BASE_URL+'/api/mcp'},headers);
      expect(result.status).toBe(400);
    }
    expect(f.db.getOAuthClient).not.toHaveBeenCalled();
  });
  it('validates exact raw body evidence but does not treat reserialized pre-parsed JSON as wire truth', () => {
    const raw='{"a":1}', headers={'content-length':String(Buffer.byteLength(raw))};
    expect(oauthTransportBodyWithinLimit({method:'POST',headers,rawBody:raw,body:{a:1}})).toBe(true);
    expect(oauthTransportBodyWithinLimit({method:'POST',headers:{'content-length':'1'},rawBody:raw,body:{a:1}})).toBe(false);
    expect(oauthTransportBodyWithinLimit({method:'POST',headers:{},body:{a:1}})).toBe(false);
    expect(oauthTransportBodyWithinLimit({method:'GET',headers:{},body:{a:1}})).toBe(true);
    expect(oauthTransportBodyWithinLimit({method:'POST',headers:{},rawBody:Buffer.alloc(MAX_OAUTH_BODY_BYTES+1)})).toBe(false);
  });
});

describe('unambiguous confidential OAuth Authorization provenance',()=>{
  it('denies duplicate, conflicting, active and mixed-case header evidence before SQL or code consumption',async()=>{
    const f=fixture();
    const basic=(await call(f.handlers.register,'POST',{redirect_uris:[callback],
      token_endpoint_auth_method:'client_secret_basic'})).value;
    const auth='Basic '+Buffer.from(basic.client_id+':'+basic.client_secret).toString('base64');
    const input={client_id:basic.client_id,grant_type:'authorization_code',
      resource:env.PUBLIC_BASE_URL+'/api/mcp',code:'unconsumed',
      code_verifier:verifier,redirect_uri:callback};
    let accessed=0;
    const distinct={};
    Object.defineProperty(distinct,'authorization',{enumerable:true,get(){accessed++;return [auth];}});
    const raw=['Authorization',auth];
    Object.defineProperty(raw,'1',{enumerable:true,configurable:true,get(){accessed++;return auth;}});
    const normalized={'content-type':'application/json',authorization:auth};
    const invalid=[
      {headers:{...normalized,Authorization:auth}},
      {headers:normalized,headersDistinct:{authorization:[auth,auth]}},
      {headers:normalized,headersDistinct:{authorization:[auth+'x']}},
      {headers:normalized,headersDistinct:{Authorization:[auth]}},
      {headers:normalized,headersDistinct:distinct},
      {headers:normalized,rawHeaders:['Authorization',auth,'authorization',auth]},
      {headers:normalized,rawHeaders:['Authorization',auth+'wrong']},
      {headers:normalized,rawHeaders:[]},
      {headers:normalized,rawHeaders:raw},
      {headers:normalized,get rawHeaders(){accessed++;throw Error('private');}}
    ];
    for(const extra of invalid){
      const res=response();
      const request=req('POST',input);
      Object.defineProperties(request,Object.getOwnPropertyDescriptors(extra));
      await f.handlers.token(request,res);
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('invalid_client');
      expect(res.body).not.toContain('private');
    }
    expect(accessed).toBe(0);
    expect(f.db.getOAuthClient).not.toHaveBeenCalled();
    expect(f.db.consumeAuthCode).not.toHaveBeenCalled();
  });
  it('preserves one consistent Node Basic credential over distinct or raw headers',async()=>{
    const f=fixture();
    const client=(await call(f.handlers.register,'POST',{redirect_uris:[callback],
      token_endpoint_auth_method:'client_secret_basic'})).value;
    const authorization='Basic '+Buffer.from(client.client_id+':'+client.client_secret).toString('base64');
    const input={client_id:client.client_id,grant_type:'unknown_grant',
      resource:env.PUBLIC_BASE_URL+'/api/mcp'};
    for(const transport of [
      {headersDistinct:{authorization:[authorization]}},
      {rawHeaders:['Authorization',authorization]}
    ]){
      const res=response();
      await f.handlers.token({...req('POST',input),headers:{
        'content-type':'application/json',authorization},...transport},res);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe('unsupported_grant_type');
    }
    expect(f.db.getOAuthClient).toHaveBeenCalledTimes(2);
    expect(f.db.consumeAuthCode).not.toHaveBeenCalled();
  });
});

describe('public OAuth CORS and OPTIONS owner-boundary isolation',()=>{
  it('answers bearer-only preflight without registering a client or reading authorization SQL',async()=>{
    const f=fixture();
    for(const handler of ['register','token','metadata','resourceMetadata']){
      const res=response();
      await f.handlers[handler]({method:'OPTIONS',headers:{origin:'https://agent.example'}},res);
      expect(res.statusCode).toBe(204);
      expect(res.ended).toBe(true);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(res.headers['Access-Control-Allow-Credentials']).toBeUndefined();
      expect(res.headers['Allow']).toMatch(/OPTIONS/);
      expect(res.body).toBeNull();
    }
    for(const method of ['createOAuthClient','getOAuthClient','consumeAuthCode','createAccessToken','rotateRefreshToken']){
      expect(f.db[method]).not.toHaveBeenCalled();
    }
  });
  it('retains normal POST flow with browser CORS and no ambient cookie permission',async()=>{
    const f=fixture(),res=response();
    await f.handlers.register({method:'POST',headers:{origin:'https://agent.example',
      'content-type':'application/json'},body:{redirect_uris:[callback]}},res);
    expect(res.statusCode).toBe(201);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Access-Control-Allow-Credentials']).toBeUndefined();
    expect(JSON.parse(res.body).client_id).toBeTruthy();
    expect(f.db.createOAuthClient).toHaveBeenCalledTimes(1);
  });
  it('does not silently allow OPTIONS from non-browser clients or active origins',async()=>{
    const f=fixture();
    for(const headers of [{}, {'content-type':'application/json'}]){
      const res=response();
      await f.handlers.register({method:'OPTIONS',headers},res);
      expect(res.statusCode).toBe(405);
      expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    }
    let calls=0;
    const headers={};
    Object.defineProperty(headers,'origin',{enumerable:true,
      get(){calls++;return 'https://agent.example';}});
    const res=response();
    await f.handlers.token({method:'OPTIONS',headers},res);
    expect(res.statusCode).toBe(405);
    expect(calls).toBe(0);
    expect(f.db.getOAuthClient).not.toHaveBeenCalled();
  });
});

describe('inert, bounded framework-preparsed OAuth payloads',()=>{
  it('rejects oversized parsed data before client registration or token lookup',async()=>{
    const f=fixture(),long='🧪'.repeat(5000);
    const registration={redirect_uris:[callback],padding:long};
    const refused=await call(f.handlers.register,'POST',registration);
    expect(refused.status).toBe(400);
    expect(refused.value.error).toBe('invalid_client_metadata');
    const input={resource:env.PUBLIC_BASE_URL+'/api/mcp',client_id:'unowned',
      grant_type:'authorization_code',padding:long};
    const token=await call(f.handlers.token,'POST',input);
    expect(token.status).toBe(400);
    expect(token.value.error).toBe('invalid_request');
    expect(f.db.createOAuthClient).not.toHaveBeenCalled();
    expect(f.db.getOAuthClient).not.toHaveBeenCalled();
  });
  it('refuses executable nested input fields without invoking getters or serializers',async()=>{
    const f=fixture(),evil={};let getters=0,serializers=0;
    Object.defineProperty(evil,'value',{enumerable:true,get(){getters++;throw Error('private');}});
    const objects=[
      {redirect_uris:[callback],metadata:evil},
      {redirect_uris:[callback],metadata:{toJSON(){serializers++;throw Error('private');}}},
      {redirect_uris:[callback],metadata:new Date()},
      {redirect_uris:[callback],metadata:new Set(['active'])}
    ];
    const cycle={};cycle.self=cycle;
    objects.push({redirect_uris:[callback],metadata:cycle});
    for(const body of objects){
      const result=await call(f.handlers.register,'POST',body);
      expect(result.status).toBe(400);
      expect(result.value.error).toBe('invalid_client_metadata');
      expect(JSON.stringify(result.value)).not.toContain('private');
    }
    expect(getters).toBe(0);
    expect(serializers).toBe(0);
    expect(f.db.createOAuthClient).not.toHaveBeenCalled();
  });
  it('binds client identity and confirmation data to a detached snapshot across asynchronous SQL hooks',async()=>{
    const f=fixture();
    const client=await registered(f);
    const code='snapshot-client';
    f.codes.set(code,{client_id:client.client_id,redirect_uri:callback,
      code_challenge:challenge,code_challenge_method:'S256',tenant:'original-tenant',
      mode:'test',profile:'read_only',listing:'compact'});
    const body={grant_type:'authorization_code',client_id:client.client_id,
      client_secret:client.client_secret,code,redirect_uri:callback,
      code_verifier:verifier,resource:env.PUBLIC_BASE_URL+'/api/mcp'};
    const originalRead=f.db.getOAuthClient.getMockImplementation();
    f.db.getOAuthClient.mockImplementation(async id=>{
      body.client_id='attacker';
      body.client_secret='attacker';
      body.grant_type='refresh_token';
      body.resource='https://wrong.invalid/api/mcp';
      return originalRead(id);
    });
    const result=await call(f.handlers.token,'POST',body);
    expect(result.status).toBe(200);
    expect(f.tokens.get(result.value.access_token)).toMatchObject({
      clientId:client.client_id,tenant:'original-tenant',mode:'test',profile:'read_only'});
    expect(f.db.consumeAuthCode).toHaveBeenCalledWith(code);
    expect(f.db.createAccessToken).toHaveBeenCalledTimes(1);
  });
  it('keeps ordinary Unicode and form-shaped JSON data compatible',async()=>{
    const f=fixture();
    const response=await call(f.handlers.register,'POST',{
      redirect_uris:[callback],client_name:'Everyday 🧪 agent',grant_types:[
        'authorization_code','refresh_token'],response_types:['code']});
    expect(response.status).toBe(201);
    expect(response.value.token_endpoint_auth_method).toBe('client_secret_post');
    expect(f.db.createOAuthClient).toHaveBeenCalledWith(expect.objectContaining({
      clientName:'Everyday 🧪 agent',redirectUris:[callback]}));
  });
});
