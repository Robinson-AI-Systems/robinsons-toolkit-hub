// Native service OAuth for implementing agents; production tool capabilities are unchanged.
import {randomBytes,createHash,generateKeyPairSync,privateDecrypt,constants} from 'node:crypto';
import {RouteError} from './config.js';
const random=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(value);
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{20,256}$/.test(value);
const fail=code=>{throw new RouteError(code);};
export function validDeveloperCredential(value){
 if(!value||value.version!==1||!['pending','connected'].includes(value.status)||
   !['read_only','everyday','full'].includes(value.profile)||typeof value.origin!=='string')return false;
 try{const u=new URL(value.origin);if(u.protocol!=='https:'||u.origin!==value.origin)return false;}catch{return false;}
 if(!token(value.clientId)||!token(value.clientSecret))return false;
 if(value.status==='connected')return token(value.accessToken)&&token(value.refreshToken)&&Number.isFinite(value.expiresAt);
 return token(value.requestId)&&token(value.pollSecret)&&token(value.verifier)&&
   typeof value.privateKey==='string'&&value.privateKey.length<4000&&typeof value.authorizationUrl==='string'&&Number.isFinite(value.expiresAt);
}
export async function protocolRequest(url,{body,bearer,fetchImpl=fetch}={}){
 let response;
 try{response=await fetchImpl(url,{method:body===undefined?'GET':'POST',redirect:'error',
   headers:{accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'}),
     ...(bearer?{authorization:'Bearer '+bearer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 }catch{fail('developer_connection_network_unavailable');}
 let text;
 try{text=await boundedBody(response,32768);}catch{fail('developer_connection_response_invalid');}
 let data;try{data=JSON.parse(text);}catch{fail('developer_connection_response_invalid');}
 // Do not reflect OAuth/provider error descriptions: they may include credentials.
 if(!response.ok&&response.status!==202){
   if(['invalid_grant','access_denied','request_unavailable'].includes(data?.error))fail('developer_connection_reauthorization_required');
   fail('developer_connection_request_failed');
 }
 return data;
}
async function boundedBody(response,limit){
 const reader=response.body?.getReader?.();
 if(!reader){const text=await response.text();if(Buffer.byteLength(text)>limit)throw Error();return text;}
 let size=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error();}chunks.push(Buffer.from(value));}}
 finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
function sameServer(value,origin,path){
 try{const u=new URL(value);return u.origin===origin&&!u.username&&!u.password&&!u.hash&&u.pathname===path&&!u.search;}catch{return false;}
}
export async function developerConnect({name,origin,vault,profile='full',fetchImpl=fetch,now=()=>Date.now()}){
 if(!['read_only','everyday','full'].includes(profile))fail('developer_profile_invalid');
 let record=await vault.getOAuth(name);
 if(record&&(!validDeveloperCredential(record)||record.origin!==origin))fail('developer_connection_origin_mismatch');
 if(record?.status==='connected')return {status:'connected',requestedProfile:record.profile,reused:true};
 if(!record||record.expiresAt<=now()){
  const metadata=await protocolRequest(origin+'/.well-known/oauth-authorization-server',{fetchImpl});
  if(!sameServer(metadata.authorization_endpoint,origin,'/api/oauth/authorize')||
    !sameServer(metadata.token_endpoint,origin,'/api/oauth/token')||
    !sameServer(metadata.registration_endpoint,origin,'/api/oauth/register'))fail('developer_oauth_endpoints_unavailable');
  const registration=await protocolRequest(metadata.registration_endpoint,{fetchImpl,body:{client_name:'Robinson implementing agent',
    redirect_uris:[origin+'/api/developer/connect'],token_endpoint_auth_method:'client_secret_post',
    grant_types:['authorization_code','refresh_token'],response_types:['code']}});
  if(!token(registration.client_id)||!token(registration.client_secret))fail('developer_registration_invalid');
  const verifier=random(),pollSecret=random();
  const keys=generateKeyPairSync('rsa',{modulusLength:2048});
  const pending=await protocolRequest(origin+'/api/developer/connect',{fetchImpl,body:{client_id:registration.client_id,
    challenge:hash(verifier).digest('base64url'),poll_hash:hash(pollSecret).digest('hex'),
    public_key:keys.publicKey.export({type:'spki',format:'pem'}),profile}});
  const u=new URL(pending.authorization_url);
  if(u.origin!==origin||u.pathname!=='/api/oauth/authorize'||u.searchParams.get('state')!==pending.request_id||
    u.searchParams.get('code_challenge')!==hash(verifier).digest('base64url')||
    u.searchParams.get('redirect_uri')!==origin+'/api/developer/connect'||
    !token(pending.request_id)||!Number.isFinite(Date.parse(pending.expires_at)))fail('developer_handoff_invalid');
  record={version:1,status:'pending',origin,clientId:registration.client_id,clientSecret:registration.client_secret,
    verifier,pollSecret,privateKey:keys.privateKey.export({type:'pkcs8',format:'pem'}),
    requestId:pending.request_id,authorizationUrl:u.href,expiresAt:Date.parse(pending.expires_at),profile};
  await vault.setOAuth(name,record);
  return {status:'awaiting_owner_authorization',authorizationUrl:u.href,expiresAt:record.expiresAt,
    next:'Open this link once. Then rerun developer-connect; there is no token to copy.'};
 }
 const pending=await protocolRequest(origin+'/api/developer/connect?state='+encodeURIComponent(record.requestId),
   {fetchImpl,bearer:record.pollSecret});
 if(pending.status==='authorization_pending')return {status:'awaiting_owner_authorization',authorizationUrl:record.authorizationUrl};
 if(pending.status!=='authorized'||typeof pending.sealed_code!=='string'||pending.sealed_code.length>1000)fail('developer_handoff_invalid');
 let code;try{code=privateDecrypt({key:record.privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},
   Buffer.from(pending.sealed_code,'base64url')).toString();}catch{fail('developer_handoff_invalid');}
 if(!token(code))fail('developer_handoff_invalid');
 const issued=await protocolRequest(origin+'/api/oauth/token',{fetchImpl,body:{grant_type:'authorization_code',client_id:record.clientId,
   client_secret:record.clientSecret,code,code_verifier:record.verifier,redirect_uri:origin+'/api/developer/connect',resource:origin+'/api/mcp'}});
 record=connected(record,issued,now());await vault.setOAuth(name,record);
 return {status:'connected',requestedProfile:record.profile,reused:false,grant:'Owner selections are enforced by the service; verify native whoami.'};
}
function connected(record,issued,now){
 // A refresh response may retain the original refresh token (RFC 6749 section 6).
 // Initial authorization still requires a renewable credential; malformed rotations fail.
 const refreshToken=Object.hasOwn(issued,'refresh_token')?issued.refresh_token:(record.status==='connected'?record.refreshToken:undefined);
 if(!token(issued.access_token)||!token(refreshToken)||!Number.isInteger(issued.expires_in)||issued.expires_in<1||issued.expires_in>2592000||issued.token_type!=='Bearer')fail('developer_token_response_invalid');
 return {version:1,status:'connected',origin:record.origin,clientId:record.clientId,clientSecret:record.clientSecret,
   profile:record.profile,accessToken:issued.access_token,refreshToken,expiresAt:now+issued.expires_in*1000};
}
const refreshVaults=new WeakMap();
export async function developerAccess({name,origin,vault,fetchImpl=fetch,now=()=>Date.now()}){
 const key=origin+'|'+name;
 let refreshing=refreshVaults.get(vault);if(!refreshing){refreshing=new Map();refreshVaults.set(vault,refreshing);}
 if(refreshing.has(key))return refreshing.get(key);
 const perform=async()=>{
  const record=await vault.getOAuth(name);
  if(!validDeveloperCredential(record)||record.status!=='connected'||record.origin!==origin)fail('developer_connection_required');
  if(record.expiresAt>now()+60000)return record.accessToken;
  const issued=await protocolRequest(origin+'/api/oauth/token',{fetchImpl,body:{grant_type:'refresh_token',client_id:record.clientId,
    client_secret:record.clientSecret,refresh_token:record.refreshToken,resource:origin+'/api/mcp'}});
  const next=connected(record,issued,now());await vault.setOAuth(name,next);return next.accessToken;
 };
 const work=typeof vault.withOAuthLock==='function'?vault.withOAuthLock(name,perform):perform();
 refreshing.set(key,work);try{return await work;}finally{refreshing.delete(key);}
}
export async function nativeMcp({name,origin,vault,method,params={},fetchImpl=fetch,now}){
 if(!['initialize','tools/list','tools/call'].includes(method))fail('developer_mcp_method_invalid');
 const access=await developerAccess({name,origin,vault,fetchImpl,now});
 let response;
 try{response=await fetchImpl(origin+'/api/mcp',{method:'POST',redirect:'error',headers:{authorization:'Bearer '+access,
   accept:'application/json, text/event-stream','content-type':'application/json','mcp-protocol-version':'2025-11-25'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});
 }catch{fail(method==='tools/call'?'developer_call_outcome_unknown_do_not_replay':'developer_mcp_network_unavailable');}
 if(response.status===401)fail('developer_connection_reauthorization_required');
 if(!response.ok)fail('developer_mcp_request_failed');
 let data;try{
  const text=await boundedBody(response,2097152);
  if((response.headers.get('content-type')||'').includes('text/event-stream')){
   const events=text.replaceAll('\r\n','\n').split('\n\n').map(e=>e.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n')).filter(Boolean);
   data=events.map(x=>JSON.parse(x)).find(x=>x.id===1);
  }else data=JSON.parse(text);
 }catch{fail(method==='tools/call'?'developer_call_outcome_unknown_do_not_replay':'developer_mcp_response_invalid');}
 if(data?.jsonrpc!=='2.0'||data.id!==1||data.error||!Object.hasOwn(data,'result'))fail('developer_mcp_response_invalid');
 return data.result;
}
