// Standard MCP OAuth resource -> issuer discovery. No provider switch statements.
import {serverNamePattern} from './server-name.js';
import {rtcModes} from './rtc-mode.js';
import {checkedRemoteUrl,pinnedMcpRequest} from './upstream-mcp-http.js';
const slug=/^[a-z][a-z0-9_]{1,59}$/;
const area=/^[a-z][a-z0-9_]{0,59}$/;
const maxAreas=32;
function exactEndpoint(value,issuerOrigin) {
 const target=checkedRemoteUrl(value,issuerOrigin);
 if(target.search)throw new Error('OAuth metadata endpoints must not contain URL query');
 return target.href;
}
function issuerWellKnown(value) {
 const issuer=checkedRemoteUrl(value);
 if(issuer.search||issuer.pathname.length>180)throw new Error('Invalid OAuth issuer');
 const path=issuer.pathname==='/'?'':issuer.pathname.replace(/\/$/,'');
 return [issuer.origin+'/.well-known/oauth-authorization-server'+path,
   issuer.origin+'/.well-known/openid-configuration'+path,
   issuer.origin+path+'/.well-known/openid-configuration'];
}
export function checkedRtcManifest(manifest) {
 if(!manifest||manifest.rtc!==1||!serverNamePattern.test(manifest.server||'')||
   !slug.test(manifest.prefix||'')||manifest.server==='hub'||manifest.prefix==='hub'||
   !Array.isArray(manifest.areas)||manifest.areas.length>maxAreas||
   manifest.areas.some(x=>!area.test(x))||new Set(manifest.areas).size!==manifest.areas.length||
   !Array.isArray(manifest.profiles)||!manifest.profiles.includes('read_only')||
   !Array.isArray(manifest.modes)||!rtcModes(manifest.modes).includes('live')||
   !manifest.counts||!['tools','writes','money'].every(k=>
     Number.isSafeInteger(manifest.counts[k])&&manifest.counts[k]>=0&&manifest.counts[k]<=1000000))
   throw new Error('Incompatible independent RTC 1 service');
 return {name:manifest.server,prefix:manifest.prefix,
  areas:[...manifest.areas],profiles:[...manifest.profiles],
  modes:rtcModes(manifest.modes),
  counts:{tools:manifest.counts.tools,writes:manifest.counts.writes,money:manifest.counts.money}};
}
export async function discoverMcpOAuth(origin,{get=pinnedMcpRequest}={}) {
 const home=checkedRemoteUrl(origin);
 if(home.pathname!=='/'||home.search)throw new Error('Use exact server HTTPS origin');
 const manifest=checkedRtcManifest(await get(origin+'/api/contract'));
 // Require RFC9728 resource metadata; servers never contact Hub to register.
 let resourceMetadata;
 for(const path of ['/.well-known/oauth-protected-resource/api/mcp',
                     '/.well-known/oauth-protected-resource']){
  try{
   const candidate=await get(origin+path);
   if(candidate?.resource===origin+'/api/mcp'&&Array.isArray(candidate.authorization_servers)){
    resourceMetadata=candidate;break;
   }
  }catch { /* discover the other standard well-known form */ }
 }
 if(!resourceMetadata||resourceMetadata.authorization_servers.length!==1)
   throw new Error('MCP OAuth resource metadata unavailable or ambiguous');
 const issuer=resourceMetadata.authorization_servers[0];
 const issuerUrl=checkedRemoteUrl(issuer);
 if(issuerUrl.search||issuerUrl.hash)throw new Error('Invalid OAuth issuer');
 let metadata;
 for(const wellKnown of issuerWellKnown(issuer)){
  try{
   const candidate=await get(wellKnown);
   if(candidate?.issuer===issuer) {metadata=candidate;break;}
  }catch { /* next standards-defined metadata location */ }
 }
 if(!metadata||!Array.isArray(metadata.code_challenge_methods_supported)||
   !metadata.code_challenge_methods_supported.includes('S256')||
   !Array.isArray(metadata.grant_types_supported)||
   !metadata.grant_types_supported.includes('authorization_code')||
   !Array.isArray(metadata.response_types_supported)||
   !metadata.response_types_supported.includes('code'))
   throw new Error('MCP OAuth authorization metadata or PKCE S256 unavailable');
 const originOfIssuer=issuerUrl.origin;
 const authorizationEndpoint=exactEndpoint(metadata.authorization_endpoint,originOfIssuer);
 const tokenEndpoint=exactEndpoint(metadata.token_endpoint,originOfIssuer);
 const registrationEndpoint=metadata.registration_endpoint?
   exactEndpoint(metadata.registration_endpoint,originOfIssuer):null;
 if(!registrationEndpoint)throw new Error('Issuer has no standard dynamic registration endpoint');
 return {origin,resource:origin+'/api/mcp',issuer,
  authorizationEndpoint,tokenEndpoint,registrationEndpoint,
  refreshSupported:metadata.grant_types_supported.includes('refresh_token'),
  ...manifest};
}
export function validateRegistration(value,metadata,redirectUri) {
 if(!value||typeof value.client_id!=='string'||value.client_id.length<1||
   value.client_id.length>256||
   (value.client_secret!==undefined&&
    (typeof value.client_secret!=='string'||value.client_secret.length>4096))||
   !['none','client_secret_post'].includes(value.token_endpoint_auth_method??'none')||
   Array.isArray(value.redirect_uris)&&!value.redirect_uris.includes(redirectUri))
   throw new Error('MCP OAuth dynamic registration refused');
 return {clientId:value.client_id,clientSecret:value.client_secret??null,
   authMethod:value.token_endpoint_auth_method??'none'};
}
