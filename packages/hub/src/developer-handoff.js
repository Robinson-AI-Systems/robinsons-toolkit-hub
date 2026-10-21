import {randomBytes,createHash,createPublicKey,publicEncrypt,constants,timingSafeEqual,scryptSync} from 'node:crypto';
import {digestPass} from './identity.js';
import {isIP} from 'node:net';
import {takeBudget} from './limits.js';
import {publicHubOrigin,verifyOwnerLogin,escapeHtml} from './owner-login.js';
import {issueOAuthCode} from './oauth.js';
import {parseOwnerServerSelection} from './server-selection.js';
import {parseInitialServiceProfiles} from './service-profile-policy.js';
import {parseInitialServiceAreas} from './service-area-policy.js';
const token=()=>randomBytes(32).toString('base64url');
const pattern=/^[A-Za-z0-9_-]{43}$/;
const profiles=new Set(['read_only','everyday','full']);
const digest=v=>createHash('sha256').update(v).digest('hex');
const text=(status,message)=>({status,html:'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Developer connection</h1><p>'+escapeHtml(message)+'</p></html>'});
// The protected-resource Hub is a real OAuth issuer. Dynamic registration
// must accept clients' own redirects, never just the old developer-handoff
// redirect. Registration ALONE grants zero authority: each connection still
// requires an original owner password, exact PKCE proof, and chosen scope.
export function checkedClientRedirect(uri){
 if(typeof uri!=='string'||uri.length<12||uri.length>512||uri.trim()!==uri)
  return null;
 let u;try{u=new URL(uri);}catch{return null;}
 if(u.href!==uri||u.username||u.password||u.hash||u.pathname.length>350)
  return null;
 if(u.protocol==='http:')
  return ['127.0.0.1','[::1]'].includes(u.hostname)&&
   u.port.length>0?uri:null;
 if(u.protocol!=='https:'||!u.hostname.includes('.')||
    isIP(u.hostname)!==0||u.hostname==='localhost'||
    /\.(?:local|internal|localhost)$/i.test(u.hostname))return null;
 return uri;
}
function registrationRequest(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).length>12||JSON.stringify(input).length>4096||
    !Array.isArray(input.redirect_uris)||input.redirect_uris.length!==1)return null;
 const redirect=checkedClientRedirect(input.redirect_uris[0]);
 if(!redirect)return null;
 const method=input.token_endpoint_auth_method??'none';
 if(!['none','client_secret_post'].includes(method)||
    input.response_types!==undefined&&
      JSON.stringify(input.response_types)!==JSON.stringify(['code']))return null;
 const grants=input.grant_types??['authorization_code','refresh_token'];
 if(!Array.isArray(grants)||!grants.includes('authorization_code')||
    grants.length>2||new Set(grants).size!==grants.length||
    grants.some(x=>!['authorization_code','refresh_token'].includes(x)))return null;
 if(input.client_name!==undefined&&(typeof input.client_name!=='string'||
    input.client_name.length>120))return null;
 return {redirect,method,grants};
}
export async function registerDeveloperClient(db,input,{env=process.env}={}){
 publicHubOrigin(env);
 const request=registrationRequest(input);
 if(!request)return {status:400,json:{error:'invalid_client_metadata'}};
 const clientId=token(),secret=token();
 // Existing developer clients remain confidential; public native clients
 // use an unreturned random digest to satisfy the historical NOT NULL row,
 // plus the explicit method column. Never interpret the digest as authority.
 const secretDigest=digestPass(secret,env.HUB_TOKEN_PEPPER);
 await db.query('BEGIN');try{
  await db.query('INSERT INTO hub_oauth_clients(client_id,owner_id,redirect_uri) VALUES($1,$2,$3)',
   [clientId,env.HUB_OWNER_ID,request.redirect]);
  await db.query(`INSERT INTO hub_developer_clients
   (client_id,secret_digest,expires_at,token_endpoint_auth_method)
   VALUES($1,$2,now()+interval '30 days',$3)`,
   [clientId,secretDigest,request.method]);
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}
 return {status:201,json:{client_id:clientId,
  ...(request.method==='client_secret_post'?{client_secret:secret}:{}),
  client_id_issued_at:Math.floor(Date.now()/1000),
  token_endpoint_auth_method:request.method,
  redirect_uris:[request.redirect],
  grant_types:request.grants,response_types:['code'],
  ...(input.client_name?{client_name:input.client_name}:{})}};
}
export async function developerClientValid(db,clientId,secret,{env=process.env}={}){
 if(!pattern.test(clientId||''))return false;
 const {rows}=await db.query(`SELECT token_endpoint_auth_method,secret_digest
 FROM hub_developer_clients WHERE client_id=$1 AND expires_at>now()`,[clientId]);
 if(rows.length!==1)return false;
 const {token_endpoint_auth_method:method,secret_digest:recorded}=rows[0];
 if(method==='none')return secret===null||secret===undefined;
 if(method!=='client_secret_post'||!pattern.test(secret||'')||
    !/^[a-f0-9]{64}$/.test(recorded||''))return false;
 const supplied=Buffer.from(digestPass(secret,env.HUB_TOKEN_PEPPER),'hex');
 return timingSafeEqual(supplied,Buffer.from(recorded,'hex'));
}
export async function developerHandoff(db,req,{env=process.env}={}){
 const origin=publicHubOrigin(env),callback=origin+'/api/developer/connect';
 if(req.method==='POST'){
  const p=req.body;
  if(!p||Object.keys(p).some(k=>!['client_id','challenge','poll_hash','public_key','profile'].includes(k))||
   !pattern.test(p.client_id||'')||!pattern.test(p.challenge||'')||!/^[a-f0-9]{64}$/.test(p.poll_hash||'')||
   !profiles.has(p.profile)||typeof p.public_key!=='string'||p.public_key.length>1000)return {status:400,json:{error:'invalid_request'}};
  let key;try{key=createPublicKey(p.public_key);if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails?.modulusLength!==2048)throw Error();}catch{return {status:400,json:{error:'invalid_request'}};}
  const found=await db.query(`SELECT 1 FROM hub_developer_clients d JOIN hub_oauth_clients c USING(client_id) WHERE d.client_id=$1 AND d.expires_at>now() AND d.token_endpoint_auth_method='client_secret_post' AND c.redirect_uri=$2`,[p.client_id,callback]);
  if(found.rows.length!==1)return {status:400,json:{error:'invalid_client'}};
  const state=token();
  const added=await db.query(`INSERT INTO hub_developer_handoffs(state,client_id,challenge,poll_hash,public_key,profile,expires_at)
   VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes') ON CONFLICT(client_id) DO UPDATE SET
   state=EXCLUDED.state,challenge=EXCLUDED.challenge,poll_hash=EXCLUDED.poll_hash,public_key=EXCLUDED.public_key,
   profile=EXCLUDED.profile,status='pending',sealed_code=NULL,expires_at=EXCLUDED.expires_at
   WHERE hub_developer_handoffs.expires_at<=now() RETURNING expires_at`,[state,p.client_id,p.challenge,p.poll_hash,key.export({type:'spki',format:'pem'}),p.profile]);
  if(added.rows.length!==1)return {status:409,json:{error:'request_active'}};
  const url=new URL('/api/oauth/authorize',origin);
  for(const [k,v]of Object.entries({client_id:p.client_id,redirect_uri:callback,response_type:'code',code_challenge:p.challenge,code_challenge_method:'S256',resource:origin+'/api/mcp',state,profile:p.profile,listing:'compact'}))url.searchParams.set(k,v);
  return {status:201,json:{request_id:state,authorization_url:url.href,expires_at:new Date(added.rows[0].expires_at).toISOString()}};
 }
 if(req.method!=='GET')return {status:405,json:{error:'method_not_allowed'}};
 const q=req.query||{};
 if(!pattern.test(q.state||'')||Object.keys(q).some(k=>!['state','code','error'].includes(k)))return {status:400,json:{error:'invalid_request'}};
 if(q.code!==undefined||q.error!==undefined){
  if(q.error!==undefined){await db.query("UPDATE hub_developer_handoffs SET status='denied' WHERE state=$1 AND status='pending'",[q.state]);return text(200,'Connection was not authorized. Return to your chat.');}
  if(!pattern.test(q.code||''))return text(400,'Invalid authorization response.');
  const found=await db.query(`SELECT h.*,c.challenge AS code_challenge,c.redirect_uri FROM hub_developer_handoffs h
   JOIN hub_oauth_codes c ON c.client_id=h.client_id AND c.code_digest=$2
   WHERE h.state=$1 AND h.expires_at>now() AND c.expires_at>now() AND c.consumed_at IS NULL`,[q.state,digestPass(q.code,env.HUB_TOKEN_PEPPER)]);
  const row=found.rows[0];
  if(!row||row.challenge!==row.code_challenge||row.redirect_uri!==callback)return text(410,'This connection request expired or does not match. Ask your agent for a new link.');
  const sealed=publicEncrypt({key:row.public_key,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(q.code)).toString('base64url');
  await db.query("UPDATE hub_developer_handoffs SET status='authorized',sealed_code=$2 WHERE state=$1 AND status='pending'",[q.state,sealed]);
  return text(200,'Authorization saved. Return to your chat. There is no token to copy.');
 }
 const secret=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers?.authorization||'')?.[1];
 if(!secret)return {status:401,json:{error:'unauthorized'}};
 const found=await db.query('SELECT status,sealed_code FROM hub_developer_handoffs WHERE state=$1 AND poll_hash=$2 AND expires_at>now()',[q.state,digest(secret)]);
 const row=found.rows[0];if(!row)return {status:410,json:{error:'request_unavailable'}};
 if(row.status==='pending')return {status:202,json:{status:'authorization_pending'}};
 if(row.status==='denied')return {status:403,json:{error:'access_denied'}};
 return {status:200,json:{status:'authorized',sealed_code:row.sealed_code}};
}
export async function developerConsent(db,req,input,{env=process.env}={}){
 const row=(await db.query(`SELECT h.* FROM hub_developer_handoffs h JOIN hub_developer_clients d USING(client_id)
  WHERE d.token_endpoint_auth_method='client_secret_post' AND h.client_id=$1 AND h.state=$2 AND d.expires_at>now()`,[input.client_id,input.state])).rows[0];
 if(!row)return null;
 if(row.status!=='pending'||new Date(row.expires_at).getTime()<=Date.now())return {status:410};
 const origin=publicHubOrigin(env),callback=origin+'/api/developer/connect';
 if(input.redirect_uri!==callback||input.code_challenge!==row.challenge||input.code_challenge_method!=='S256'||input.response_type!=='code'||input.resource!==origin+'/api/mcp'||input.profile!==row.profile)return {status:400};
 if(req.method==='GET')return {status:200,fields:{client_id:row.client_id,state:row.state,redirect_uri:callback,code_challenge:row.challenge,code_challenge_method:'S256',response_type:'code',resource:origin+'/api/mcp',profile:row.profile}};
 const profile=input.delegation_profile??row.profile,mode=input.delegation_mode??'test';
 const allowWrites=input.delegation_writes==='authorize';
 if(!profiles.has(profile)||!['test','live'].includes(mode)||
   ![undefined,'disabled','authorize'].includes(input.delegation_writes)||
   (allowWrites&&(!['everyday','full'].includes(profile)||input.write_ack!=='I_AUTHORIZE'))||
   (!allowWrites&&input.write_ack))return {status:400};
 const selected=input.servers?parseOwnerServerSelection(input.servers):null;
 if(allowWrites&&!selected)return {status:400};
 let policies=null,areas=null;
 try{
  policies=parseInitialServiceProfiles(input.profiles,selected);
  areas=parseInitialServiceAreas(input.service_areas,selected);
 }catch{return {status:400};}
 const verified=await verifyOwnerLogin(db,req,input.password,{env});
 if(!verified.approved)return {status:verified.retryAfter?429:401,retryAfter:verified.retryAfter};
 await db.query("UPDATE hub_developer_clients SET expires_at='infinity'::timestamptz WHERE client_id=$1",[row.client_id]);
 const code=await issueOAuthCode(db,{ownerId:env.HUB_OWNER_ID,clientId:row.client_id,redirectUri:callback,challenge:row.challenge,profile,mode,allowWrites,areas:['gateway'],
  ...(selected?{serverNames:selected}:{}),
  ...(policies?{serviceProfiles:policies}:{}),
  ...(areas?{serviceAreas:areas}:{})},{pepper:env.HUB_TOKEN_PEPPER,ownerVerified:true});
 const url=new URL(callback);url.searchParams.set('code',code);url.searchParams.set('state',row.state);
 return {status:303,redirect:url.href};
}
export async function ownerSetup(db,req,{env=process.env,now=()=>Date.now()}={}){
 const input=req.method==='GET'?req.query:req.body;
 const setup=input?.setup_token;
 const expires=Date.parse(env.HUB_OWNER_SETUP_EXPIRES||'');
 if(env.HUB_OWNER_SCRYPT||!pattern.test(setup||'')||!Number.isFinite(expires)||expires<=now()||
  !/^[a-f0-9]{64}$/.test(env.HUB_OWNER_SETUP_HASH||'')||
  !timingSafeEqual(Buffer.from(digest(setup)),Buffer.from(env.HUB_OWNER_SETUP_HASH)))return text(403,'Owner setup is unavailable or expired.');
 if((await db.query('SELECT 1 FROM hub_owner_credentials WHERE owner_id=$1',[env.HUB_OWNER_ID])).rows.length)return text(409,'Owner authentication is already configured.');
 if(req.method==='GET')return {status:200,html:'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Set your Hub owner passphrase</h1><form method="POST" action="/api/owner/setup"><input type="hidden" name="setup_token" value="'+escapeHtml(setup)+'"><label>Passphrase <input type="password" name="password" autocomplete="new-password" required minlength="12" maxlength="256"></label><label>Confirm <input type="password" name="confirmation" autocomplete="new-password" required></label><button>Save owner passphrase</button></form></html>'};
 if(req.method!=='POST')return text(405,'Method not allowed.');
 const password=input.password;
 if(typeof password!=='string'||password.length<12||password.length>256||password!==input.confirmation)return text(400,'Enter matching passphrases of 12–256 characters.');
 const budget=await takeBudget(db,{scope:'owner-setup:'+env.HUB_OWNER_ID,pepper:env.HUB_TOKEN_PEPPER,max:5,seconds:900});
 if(!budget.allowed)return text(429,'Try owner setup later.');
 const salt=randomBytes(16),hash=scryptSync(password,salt,32,{N:16384,r:8,p:1,maxmem:32*1024*1024});
 const verifier='s1.'+salt.toString('base64url')+'.'+hash.toString('base64url');
 const saved=await db.query('INSERT INTO hub_owner_credentials(owner_id,verifier) VALUES($1,$2) ON CONFLICT(owner_id) DO NOTHING RETURNING owner_id',[env.HUB_OWNER_ID,verifier]);
 return text(saved.rows.length?201:409,saved.rows.length?'Owner passphrase saved. Return to your chat.':'Owner authentication is already configured.');
}
