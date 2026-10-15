import { it,expect,vi } from 'vitest';
import { scryptSync,randomBytes } from 'node:crypto';
import { publicHubOrigin,verifyOwnerPassword,formFields,authorizationRequest,
  htmlForm,authorizeOwnerConnection,registerOwnerClient } from '../src/owner-login.js';
const raw='synthetic-test-only-owner-passphrase';
const salt=randomBytes(16);
const derived=scryptSync(raw,salt,32,{N:16384,r:8,p:1,maxmem:32*1024*1024});
const env={HUB_OWNER_ID:'single-owner',HUB_PUBLIC_ORIGIN:'https://hub.example',
  HUB_TOKEN_PEPPER:'synthetic-test-pepper-only-do-not-deploy',
  HUB_OWNER_SCRYPT:'s1.'+salt.toString('base64url')+'.'+derived.toString('base64url')};
const request={client_id:'approvedclient',redirect_uri:'https://agent.example/callback',
  code_challenge:'c'.repeat(43),state:'client-generated-state-0123456789',
  code_challenge_method:'S256',response_type:'code'};
it('rejects insecure origins and owner password mismatches',()=>{
  expect(publicHubOrigin(env)).toBe('https://hub.example');
  for(const bad of ['http://hub.example','https://hub.example/path',
    'https://hub.example?next=x','https://example.com@evil.example'])
    expect(()=>publicHubOrigin({...env,HUB_PUBLIC_ORIGIN:bad})).toThrow();
  expect(verifyOwnerPassword(raw,env.HUB_OWNER_SCRYPT)).toBe(true);
  expect(verifyOwnerPassword('wrong',env.HUB_OWNER_SCRYPT)).toBe(false);
});
it('validates only S256 registered redirect requests and escapes browser form',()=>{
  expect(authorizationRequest(request).clientId).toBe('approvedclient');
  expect(authorizationRequest({...request,response_type:'token'})).toBeNull();
  expect(authorizationRequest({...request,code_challenge_method:'plain'})).toBeNull();
  expect(htmlForm('/api/oauth/authorize',{state:'"><script>'})).not.toContain('value=""><script>');
  expect(formFields({method:'POST',body:'a=1&a=2'})).toBeNull();
});
it('consent fails closed and issues only read_only TEST for the exact owner/client',async()=>{
  const clientDb={query:vi.fn(async sql=>({rows:sql.includes('hub_request_limits') ? [{hits:1}] : [{owner_id:'single-owner'}]}))};
  const authorize=vi.fn().mockResolvedValue('synthetic-code');
  const req={method:'GET',socket:{remoteAddress:'127.0.0.1'}};
  const get=await authorizeOwnerConnection(clientDb,req,request,{env,issue:authorize});
  expect(get.status).toBe(200);
  expect(authorize).not.toHaveBeenCalled();
  const post={...req,method:'POST'};
  const denied=await authorizeOwnerConnection(clientDb,post,{...request,password:'wrong',servers:'stripe'},
    {env,issue:authorize});
  expect(denied.status).toBe(401);
  expect(authorize).not.toHaveBeenCalled();
  const accepted=await authorizeOwnerConnection(clientDb,post,{...request,password:raw,servers:'stripe,workspace'},
    {env,issue:authorize});
  expect(accepted.status).toBe(303);
  expect(accepted.redirect).toContain('code=synthetic-code');
  expect(authorize.mock.calls[0][1]).toMatchObject({
    ownerId:'single-owner',profile:'read_only',mode:'test',areas:['gateway'],
    serverNames:['stripe','workspace']});
});
it('owner-only client registration refuses incorrect passphrase',async()=>{
  const db={query:vi.fn().mockResolvedValue({rows:[{hits:1}]})};
  const register=vi.fn();
  const req={method:'POST',socket:{remoteAddress:'127.0.0.1'}};
  expect((await registerOwnerClient(db,req,{client_id:'approvedclient',
    redirect_uri:'https://agent.example/cb',password:'wrong'},{env,register})).status).toBe(401);
  expect(register).not.toHaveBeenCalled();
});
it('retains safe Node-parsed owner form fields without accepting arrays or inherited values',async()=>{
 const {parse}=await import('node:querystring');
 const body=parse('setup_token=FAKE_ACTIVATION&password=FAKE_PASSWORD&confirmation=FAKE_PASSWORD');
 expect(formFields({method:'POST',body})).toBe(body);
 expect(formFields({method:'POST',body:parse('password=first&password=second')})).toBeNull();
 expect(formFields({method:'POST',body:Object.assign(Object.create({password:'inherited'}),{setup_token:'FAKE'})})).toBeNull();
});

it('OAuth consent requires an explicit valid server subset before password verification',async()=>{
 const clientDb={query:vi.fn(async()=>({rows:[{owner_id:'single-owner'}]}))};
 const issue=vi.fn();
 const req={method:'POST',socket:{remoteAddress:'127.0.0.1'}};
 for(const servers of ['', 'stripe,stripe', 'https://evil.example', 'Stripe']) {
   const result=await authorizeOwnerConnection(clientDb,req,{
     ...request,password:raw,servers},{env,issue});
   expect(result.status).toBe(400);
 }
 expect(issue).not.toHaveBeenCalled();
 const html=htmlForm('/api/oauth/authorize',request);
 expect(html).toContain('name="servers"');
 expect(html).not.toContain('rtc_pass_');
});

it('owner OAuth consent binds initially selected per-service profile ceilings',async()=>{
 const db={query:vi.fn(async sql=>({rows:sql.includes('hub_request_limits') ?
  [{hits:1}]:[{owner_id:'single-owner'}]}))};
 const issue=vi.fn(async()=> 'synthetic-oauth-code');
 const req={method:'POST',socket:{remoteAddress:'127.0.0.1'}};
 const input={...request,password:raw,servers:'stripe,workspace',
  profiles:'stripe=disabled,workspace=read_only'};
 const result=await authorizeOwnerConnection(db,req,input,{env,issue});
 expect(result.status).toBe(303);
 expect(issue).toHaveBeenCalledWith(db,expect.objectContaining({
  profile:'read_only',mode:'test',serverNames:['stripe','workspace'],
  serviceProfiles:{stripe:'disabled',workspace:'read_only'}
 }),{pepper:env.HUB_TOKEN_PEPPER,ownerVerified:true});
 issue.mockClear();
 for(const invalid of ['stripe=full','third=disabled',
  'stripe=disabled,stripe=read_only']){
  const denied=await authorizeOwnerConnection(db,req,
    {...input,profiles:invalid},{env,issue});
  expect(denied.status).toBe(400);
 }
 expect(issue).not.toHaveBeenCalled();
 const html=htmlForm('/api/oauth/authorize',request);
 expect(html).toContain('name="profiles"');
});

it('consent parses exact initial service areas before owner authentication and binds PKCE issue',async()=>{
 const db={query:vi.fn(async sql=>({rows:sql.includes('hub_request_limits')?
  [{hits:1}]:[{owner_id:'single-owner'}]}))};
 const issue=vi.fn(async()=> 'synthetic-oauth-code');
 const req={method:'POST',socket:{remoteAddress:'127.0.0.1'}};
 const input={...request,password:raw,servers:'stripe,workspace',
  service_areas:'stripe:billing|reports,workspace:drive'};
 const accepted=await authorizeOwnerConnection(db,req,input,{env,issue});
 expect(accepted.status).toBe(303);
 expect(issue).toHaveBeenCalledWith(db,expect.objectContaining({
  serverNames:['stripe','workspace'],serviceAreas:{
   stripe:['billing','reports'],workspace:['drive']}}),
  {pepper:env.HUB_TOKEN_PEPPER,ownerVerified:true});
 issue.mockClear();
 for(const malformed of ['stripe:billing|billing','unknown:billing',
  'stripe:','stripe:billing,stripe:reports','stripe:billing|BAD',
  'stripe:billing:reports']){
  const denied=await authorizeOwnerConnection(db,req,{...input,
    service_areas:malformed},{env,issue});
  expect(denied.status).toBe(400);
 }
 expect(issue).not.toHaveBeenCalled();
 expect(htmlForm('/api/oauth/authorize',request)).toContain('name="service_areas"');
});
