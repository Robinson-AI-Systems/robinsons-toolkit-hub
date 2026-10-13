import { scryptSync, timingSafeEqual } from 'node:crypto';
import { takeBudget } from './limits.js';
import { registerOAuthClient, issueOAuthCode } from './oauth.js';

export function publicHubOrigin(env=process.env) {
  const configured=env.HUB_PUBLIC_ORIGIN;
  if (typeof configured!=='string') throw new Error('Hub public origin not configured');
  let url;
  try { url=new URL(configured); } catch { throw new Error('Hub public origin not configured'); }
  if (url.protocol!=='https:' || url.origin!==configured || url.username || url.password ||
    url.search || url.hash || url.pathname!=='/')
    throw new Error('Hub public origin must be a verified exact HTTPS origin');
  return configured;
}
export function verifyOwnerPassword(password, stored) {
  if (typeof password!=='string' || password.length>256 || typeof stored!=='string' ||
    !/^s1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(stored)) return false;
  try {
    const [,encodedSalt,encodedDigest]=stored.split('.');
    const wanted=Buffer.from(encodedDigest,'base64url');
    const actual=scryptSync(password,Buffer.from(encodedSalt,'base64url'),32,
      {N:16384,r:8,p:1,maxmem:32*1024*1024});
    return wanted.length===32 && timingSafeEqual(wanted,actual);
  } catch { return false; }
}
function validOwner(env) {
  return typeof env.HUB_OWNER_ID==='string' &&
    /^[A-Za-z0-9:_-]{1,120}$/.test(env.HUB_OWNER_ID);
}
export async function verifyOwnerLogin(db, req, password, {env=process.env}={}) {
  if (!validOwner(env) || !env.HUB_TOKEN_PEPPER)
    throw new Error('Hub owner authentication not configured');
  const stored=env.HUB_OWNER_SCRYPT || (await db.query(
    'SELECT verifier FROM hub_owner_credentials WHERE owner_id=$1',[env.HUB_OWNER_ID])).rows[0]?.verifier;
  if(!stored)throw new Error('Hub owner authentication not configured');
  // Only the trusted transport peer is used; client-supplied IP headers cannot
  // bypass the database-backed 5 attempts / 15 minutes lockout.
  const peer=req.socket?.remoteAddress || 'unknown';
  const budget=await takeBudget(db,{scope:'owner-login:'+env.HUB_OWNER_ID+':'+peer,
    pepper:env.HUB_TOKEN_PEPPER,max:5,seconds:900});
  if (!budget.allowed) return {approved:false,retryAfter:budget.retryAfter};
  return {approved:verifyOwnerPassword(password,stored)};
}
export function formFields(req) {
  const body=req.method==='GET' ? req.query : req.body;
  if (typeof body==='string' && Buffer.byteLength(body)<=8192) {
    const params=new URLSearchParams(body);
    const result={};
    for (const [key,value] of params) {
      if (Object.hasOwn(result,key)) return null;
      result[key]=value;
    }
    return result;
  }
  if (!body || typeof body!=='object' || Array.isArray(body) ||
    ![Object.prototype,null].includes(Object.getPrototypeOf(body))) return null;
  const keys=Object.keys(body);
  if (keys.length>12 || keys.some(k=> k.length>40 || typeof body[k]!=='string' ||
      body[k].length>2048)) return null;
  return body;
}
export function authorizationRequest(input) {
  if (!input || input.response_type!=='code' || input.code_challenge_method!=='S256' ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(input.client_id||'') ||
    !/^[A-Za-z0-9_-]{43}$/.test(input.code_challenge||'') ||
    !/^[A-Za-z0-9._~-]{16,200}$/.test(input.state||'') ||
    typeof input.redirect_uri!=='string' || input.redirect_uri.length>512)
    return null;
  return {clientId:input.client_id,redirectUri:input.redirect_uri,
    challenge:input.code_challenge,state:input.state};
}
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}
export function htmlForm(action,fields) {
  const hidden=Object.entries(fields).map(([key,value])=>
    '<input type="hidden" name="'+escapeHtml(key)+'" value="'+escapeHtml(value)+'">').join('');
  return '<!doctype html><html lang="en"><meta charset="utf-8">'+
    '<title>Robinson Toolkit Hub owner approval</title><main>'+
    '<h1>Authorize a TEST Toolkit Hub connection</h1>'+
    '<p>Requested profile: '+escapeHtml(fields.profile||'read_only')+'</p>'+
    '<p>Only this Hub is authorized. Upstream provider access requires separate scoped grants.</p>'+
    '<form method="POST" action="'+escapeHtml(action)+'">'+hidden+
    '<label>Owner passphrase <input type="password" name="password" autocomplete="current-password" required></label>'+
    '<button type="submit">Authorize</button></form></main></html>';
}
export function htmlHeaders(res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Content-Type','text/html; charset=utf-8');
}
export async function authorizeOwnerConnection(db, req, input, {env=process.env,
  issue=issueOAuthCode}={}) {
  const request=authorizationRequest(input);
  if (!request) return {status:400};
  const client=await db.query(`SELECT owner_id FROM hub_oauth_clients
    WHERE client_id=$1 AND redirect_uri=$2`,[request.clientId,request.redirectUri]);
  if (client.rows.length!==1 || client.rows[0].owner_id!==env.HUB_OWNER_ID)
    return {status:400};
  if (req.method==='GET') return {status:200,fields:{
    client_id:request.clientId,redirect_uri:request.redirectUri,
    code_challenge:request.challenge,state:request.state,
    code_challenge_method:'S256',response_type:'code'}};
  const verified=await verifyOwnerLogin(db,req,input.password,{env});
  if (!verified.approved) return {status:verified.retryAfter?429:401,
    retryAfter:verified.retryAfter||null};
  const code=await issue(db,{ownerId:env.HUB_OWNER_ID,clientId:request.clientId,
    redirectUri:request.redirectUri,challenge:request.challenge,
    profile:'read_only',mode:'test',areas:['gateway']},
  {pepper:env.HUB_TOKEN_PEPPER,ownerVerified:true});
  const destination=new URL(request.redirectUri);
  destination.searchParams.set('code',code);
  destination.searchParams.set('state',request.state);
  return {status:303,redirect:destination.toString()};
}
export async function registerOwnerClient(db,req,input,{env=process.env,
  register=registerOAuthClient}={}) {
  if (typeof input?.client_id!=='string' || typeof input?.redirect_uri!=='string')
    return {status:400};
  const verified=await verifyOwnerLogin(db,req,input.password,{env});
  if (!verified.approved) return {status:verified.retryAfter?429:401,
    retryAfter:verified.retryAfter||null};
  await register(db,{ownerId:env.HUB_OWNER_ID,clientId:input.client_id,
    redirectUri:input.redirect_uri},{ownerVerified:true});
  return {status:201};
}
