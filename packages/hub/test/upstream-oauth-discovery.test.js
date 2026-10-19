import {it,expect,vi} from 'vitest';
import {checkedRemoteUrl,pinnedMcpRequest} from '../src/upstream-mcp-http.js';
import {checkedRtcManifest,discoverMcpOAuth,validateRegistration}
 from '../src/upstream-oauth-discovery.js';

const origin='https://mcp.example.org',issuer='https://login.example.org';
const contract={rtc:1,server:'independent-mcp',prefix:'independent',
 areas:['mail','files'],profiles:['read_only','everyday','full'],
 modes:['test','live'],counts:{tools:200,writes:17,money:0}};
const rpc={resource:origin+'/api/mcp',authorization_servers:[issuer]};
const metadata={issuer,authorization_endpoint:issuer+'/authorize',
 token_endpoint:issuer+'/token',registration_endpoint:issuer+'/register',
 grant_types_supported:['authorization_code','refresh_token'],
 response_types_supported:['code'],code_challenge_methods_supported:['S256']};
const get=vi.fn(async url=>{
 if(url===origin+'/api/contract')return contract;
 if(url===origin+'/.well-known/oauth-protected-resource')return rpc;
 if(url===issuer+'/.well-known/oauth-authorization-server')return metadata;
 throw Error('Unknown synthetic URL');
});
it('discovers independently registered provider and exact MCP OAuth issuer, no brand logic',async()=>{
 const found=await discoverMcpOAuth(origin,{get});
 expect(found).toMatchObject({name:'independent-mcp',prefix:'independent',
  resource:origin+'/api/mcp',issuer,registrationEndpoint:issuer+'/register',
  refreshSupported:true,counts:{tools:200,writes:17,money:0}});
 expect(get.mock.calls.map(x=>x[0])).toContain(issuer+'/.well-known/oauth-authorization-server');
 expect(found).not.toHaveProperty('clientSecret');
});
it('refuses malicious origin, issuer injection, unsafe paths and unsupported PKCE',async()=>{
 for(const url of ['http://mcp.example.org','https://127.0.0.1',
  'https://one.local','https://name.example.org:8443',
  'https://mcp.example.org@evil.example.net','https://mcp.example.org/eager']){
  await expect(discoverMcpOAuth(url,{get})).rejects.toThrow();
 }
 expect(()=>checkedRemoteUrl('https://user:secret@mcp.example.org')).toThrow();
 expect(()=>checkedRemoteUrl('https://127.0.0.1/route')).toThrow();
 expect(()=>checkedRemoteUrl(issuer+'/different','https://example.net')).toThrow();
 await expect(discoverMcpOAuth(origin,{get:async url=>{
  if(url===origin+'/api/contract')return contract;
  if(url===origin+'/.well-known/oauth-protected-resource')return {
   ...rpc,authorization_servers:['http://evil.example.net']};
  throw Error('bad');
 }})).rejects.toThrow();
 await expect(discoverMcpOAuth(origin,{get:async url=>{
  if(url===issuer+'/.well-known/oauth-authorization-server')return {
   ...metadata,code_challenge_methods_supported:['plain']};
  return get(url);
 }})).rejects.toThrow();
});
it('rejects contract profile/mode spoofing and invalid client registration response',()=>{
 for(const bad of [{...contract,rtc:2},{...contract,server:'other/user'},
  {...contract,modes:['test']},{...contract,prefix:'bad-prefix'},
  {...contract,areas:['mail','mail']},{...contract,counts:{tools:100000000}}])
  expect(()=>checkedRtcManifest(bad)).toThrow();
 const redirect='https://hub.example.org/api/owner/connect-mcp-callback';
 expect(validateRegistration({client_id:'synthetic-client',client_secret:'s',
  token_endpoint_auth_method:'client_secret_post',redirect_uris:[redirect]},
   metadata,redirect)).toMatchObject({clientId:'synthetic-client',clientSecret:'s'});
 expect(()=>validateRegistration({client_id:'a',redirect_uris:['https://evil.example.org/cb']},
   metadata,redirect)).toThrow();
});
it('pins Node TLS, refuses off-host responses and never sends an inbound Hub bearer',async()=>{
 const request=vi.fn((options,callback)=>{
  expect(options.hostname).toBe('mcp.example.org');
  expect(options.agent).toBe(false);
  expect(options.rejectUnauthorized).toBe(true);
  expect(options.headers.authorization).toBeUndefined();
  const events={};
  const res={statusCode:200,headers:{'content-type':'application/json'},
   on(event,cb){events[event]=cb;return this;}};
  const req={on(){return this;},setTimeout(){return this;},end(){
   callback(res);events.data(Buffer.from('{"ok":true}'));events.end();
  },destroy(){}};
  return req;
 });
 const result=await pinnedMcpRequest(origin+'/api/contract',{request});
 expect(result).toEqual({ok:true});
 expect(request).toHaveBeenCalledTimes(1);
});
