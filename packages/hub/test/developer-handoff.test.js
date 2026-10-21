import {it,expect,vi} from 'vitest';
import {htmlForm} from '../src/owner-login.js';
import {registerDeveloperClient,developerHandoff,developerClientValid,ownerSetup,checkedClientRedirect} from '../src/developer-handoff.js';
const env={HUB_PUBLIC_ORIGIN:'https://hub.example',HUB_OWNER_ID:'synthetic-owner',HUB_TOKEN_PEPPER:'synthetic-test-only-pepper-for-unit-tests'};
it('rejects invalid registration metadata and malformed handoffs before database access',async()=>{
 const db={query:vi.fn()};
 expect((await registerDeveloperClient(db,{redirect_uris:['http://attacker.example/path']},{env})).status).toBe(400);
 expect((await developerHandoff(db,{method:'POST',body:{profile:'full'}},{env})).status).toBe(400);
 expect(await developerClientValid(db,'bad','bad',{env})).toBe(false);expect(db.query).not.toHaveBeenCalled();
});
it('first-time setup denies missing, expired and already-configured activation before reads',async()=>{
 const db={query:vi.fn()};
 for(const changed of [env,{...env,HUB_OWNER_SETUP_HASH:'a'.repeat(64),HUB_OWNER_SETUP_EXPIRES:'2000-01-01'},{...env,HUB_OWNER_SCRYPT:'configured'}])expect((await ownerSetup(db,{method:'GET',query:{setup_token:'x'.repeat(43)}},{env:changed})).status).toBe(403);
 expect(db.query).not.toHaveBeenCalled();
});
it('valid dynamic registration returns confidential client data only to the caller and rolls back failure',async()=>{
 const db={query:vi.fn().mockResolvedValue({rows:[]})};
 const input={redirect_uris:[env.HUB_PUBLIC_ORIGIN+'/api/developer/connect'],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'client_secret_post'};
 const r=await registerDeveloperClient(db,input,{env});expect(r.status).toBe(201);expect(r.json.client_secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
 expect(db.query.mock.calls.find(([sql])=>sql.includes('secret_digest'))[1][1]).not.toBe(r.json.client_secret);
 db.query.mockRejectedValueOnce(Error('private-db-detail'));await expect(registerDeveloperClient(db,input,{env})).rejects.toThrow();
});

it('supports native independent HTTPS and loopback client redirect registration without automatic issuer authority',async()=>{
 const db={query:vi.fn().mockResolvedValue({rows:[]})};
 const callback='https://coding-agent.example.org/oauth/callback';
 const r=await registerDeveloperClient(db,{
  redirect_uris:[callback],grant_types:['authorization_code','refresh_token'],
  response_types:['code'],token_endpoint_auth_method:'none',
  client_name:'Example unrelated coding client'},{env});
 expect(r.status).toBe(201);
 expect(r.json).toMatchObject({
  client_id:expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
  token_endpoint_auth_method:'none',redirect_uris:[callback],
  response_types:['code']});
 expect(r.json).not.toHaveProperty('client_secret');
 const created=db.query.mock.calls.filter(([sql])=>sql.includes('INSERT INTO hub_'));
 expect(created).toHaveLength(2);
 expect(created[0][1][2]).toBe(callback);
 expect(created[1][1][2]).toBe('none');
 expect(JSON.stringify(created)).not.toContain('Example unrelated coding client');
 expect(checkedClientRedirect('http://127.0.0.1:4027/callback')).not.toBeNull();
 expect(checkedClientRedirect('http://[::1]:4027/callback')).not.toBeNull();
 for(const url of ['https://localhost/callback','http://localhost:5555/cb',
  'http://169.254.0.1/cb','https://127.0.0.1/cb',
  'https://user:password@public.example.org/cb',
  'https://public.example.org/cb#code','javascript:alert(1)',
  'https://public.example.org:443/cb','https://internal.local/cb']){
   expect(checkedClientRedirect(url)).toBeNull();
 }
});
it('preserves registered confidential MCP coding client with its own HTTPS callback',async()=>{
 const db={query:vi.fn().mockResolvedValue({rows:[]})};
 const out=await registerDeveloperClient(db,{redirect_uris:[
   'https://other-agent.example.org/oauth/callback'],
  grant_types:['authorization_code'],response_types:['code'],
  token_endpoint_auth_method:'client_secret_post'},{env});
 expect(out.status).toBe(201);
 expect(out.json.client_secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
 expect(out.json.token_endpoint_auth_method).toBe('client_secret_post');
 for(const candidate of [
  {redirect_uris:['http://attacker.example.org/cb']},
  {redirect_uris:['https://one.example.org/cb','https://two.example.org/cb']},
  {redirect_uris:['https://public.example.org/cb'],token_endpoint_auth_method:'client_secret_basic'},
  {redirect_uris:['https://public.example.org/cb'],response_types:['token']}
 ]){
  const before=db.query.mock.calls.length;
  expect((await registerDeveloperClient(db,candidate,{env})).status).toBe(400);
  expect(db.query.mock.calls).toHaveLength(before);
 }
});

it('owner approval page identifies the exact external client callback, never a hidden client identity',()=>{
 const rendered=htmlForm('/api/oauth/authorize',{
  client_id:'synthetic1234',redirect_uri:'https://agent.example.org/authorize/callback?platform=mobile',
  code_challenge:'a'.repeat(43),state:'state-synthetic'});
 expect(rendered).toContain('Unverified external OAuth client callback');
 expect(rendered).toContain('https://agent.example.org/authorize/callback?platform=mobile');
 expect(rendered).toContain('delegation_mode');
 expect(rendered).toContain('delegation_writes');
 expect(rendered).not.toContain('client_secret');
 const unsafe=htmlForm('/api/oauth/authorize',{
  redirect_uri:'https://agent.example.org/?x=<script>alert(1)</script>'});
 expect(unsafe).not.toContain('<script>');
 expect(unsafe).toContain('&lt;script&gt;');
});

it('preserves original confidential authentication only for proven pre-028 schema, never unknown DB failures',async()=>{
 const {digestPass}=await import('../src/identity.js');
 const client='l'.repeat(43),secret='s'.repeat(43);
 const db={query:vi.fn(async(sql)=>{
  if(sql.startsWith('SELECT token_endpoint_auth_method'))throw Object.assign(Error('missing optional column'),{code:'42703'});
  expect(sql).toContain("'client_secret_post' AS token_endpoint_auth_method");
  return {rows:[{token_endpoint_auth_method:'client_secret_post',secret_digest:digestPass(secret,env.HUB_TOKEN_PEPPER)}]};
 })};
 expect(await developerClientValid(db,client,secret,{env})).toBe(true);
 expect(await developerClientValid(db,client,'w'.repeat(43),{env})).toBe(false);
 expect(await developerClientValid(db,client,undefined,{env})).toBe(false);
 const denied={query:vi.fn(async()=>{throw Object.assign(Error('storage unavailable'),{code:'08006'});})};
 await expect(developerClientValid(denied,client,secret,{env})).rejects.toThrow('storage unavailable');
 expect(denied.query).toHaveBeenCalledTimes(1);
});
