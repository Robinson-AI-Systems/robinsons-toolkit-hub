// One provider-neutral Hub owner UI. MCP service remains independent.
// Browser login and credentials are exchanged directly with that service's
// OAuth issuer. Never ask users to paste service passes into ChatGPT.
import {escapeHtml,formFields,htmlHeaders,publicHubOrigin,verifyOwnerLogin}
 from './owner-login.js';
import {discoverMcpOAuth} from './upstream-oauth-discovery.js';
import {beginUpstreamOauth,finishUpstreamOauth,
 listUpstreamOauthConnections,remoteConnectionRead,disconnectUpstreamOauth}
 from './upstream-oauth-connections.js';

const esc=x=>escapeHtml(x??'');
const mode=x=>['test','live'].includes(x);
const profile=x=>['read_only','everyday','full'].includes(x);
const slug=/^[a-z][a-z0-9_]{0,59}$/;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function shell(body){
 return '<!doctype html><html lang="en"><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>Connect an MCP server to Hub</title><main>'+
  '<h1>Connect an MCP server</h1>'+
  '<p>Hub initiates discovery and a standard OAuth consent flow at your MCP server. '+
  'Each server works independently. No manual TEST passes are required here.</p>'+
  body+'</main></html>';
}
const form=()=>shell('<form method="POST" action="/api/owner/connect-mcp">'+
 '<input type="hidden" name="action" value="inspect">'+
 '<label>Exact service HTTPS origin <input name="origin" type="url" required '+
 'maxlength="255" placeholder="https://mcp.example.com"></label>'+
 '<label>Hub owner passphrase <input name="password" type="password" required></label>'+
 '<button>Discover service and OAuth support</button></form>'+
 '<p>You can inspect current connections using the same owner passphrase.</p>'+
 '<form method="POST" action="/api/owner/connect-mcp">'+
 '<input type="hidden" name="action" value="list">'+
 '<label>Hub owner passphrase <input name="password" type="password" required></label>'+
 '<button>View connected MCP servers</button></form>');
function consent(remote){
 const fields=['<input type="hidden" name="action" value="start">',
  '<input type="hidden" name="origin" value="'+esc(remote.origin)+'">'];
 const supported=remote.areas.map(x=>'<label><input type="checkbox" disabled> '+
  esc(x)+'</label>').join(' ');
 return shell('<h2>'+esc(remote.name)+'</h2>'+
  '<p>Verified RTC 1, prefix '+esc(remote.prefix)+
  ', '+esc(remote.counts.tools)+' advertised tools. The server supports '+ 
  esc(remote.modes.join(', '))+' mode(s).</p>'+
  '<p>Available areas (type only areas you approve below): '+supported+'</p>'+
  '<p>This will register Hub as an OAuth client with the remote service and '+
  'open the service-owned sign-in page. Hub cannot grant permissions that '+
  'the service does not authorize.</p>'+
  '<form method="POST" action="/api/owner/connect-mcp">'+fields.join('')+
  '<label>Approved RTC areas (comma-separated; required) '+
  '<input name="areas" maxlength="2048" required></label>'+
  '<label>Provider OAuth scopes (optional; space-separated) '+
  '<input name="scopes" maxlength="500"></label>'+
  '<label>Hub OAuth connection family ID (optional if only one eligible) '+
  '<input name="family" maxlength="80"></label>'+
  '<label>Environment <select name="mode">'+
   remote.modes.map(x=>'<option value="'+esc(x)+'"'+(x==='live'?' selected':'')+'>'+
    esc(x)+'</option>').join('')+'</select></label>'+
  '<label>Permission profile <select name="profile">'+
   remote.profiles.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+
   '</select></label>'+
  '<label>For LIVE or write permissions type I_AUTHORIZE after reviewing the '+
  'provider account, cost and access implications '+
  '<input name="risk_ack" maxlength="16"></label>'+
  '<label>Owner passphrase (independent approval) '+
  '<input name="password" type="password" required></label>'+
  '<button>Continue to provider OAuth consent</button></form>');
}
function inventory(records){
 return shell('<h2>Owner-scoped OAuth connections</h2>'+
  '<p>Locally stored and encrypted. Provider session validity is not implied '+
  'by stored access expiry; tool discovery performs a fresh provider request.</p><ul>'+
  records.map(row=>'<li><strong>'+esc(row.server)+'</strong> — '+esc(row.state)+
    ' ('+esc(row.mode)+' / '+esc(row.profile)+') expires '+esc(row.expiresAt)+
    '; refresh '+(row.state==='reconnect_required'?'not available':
     'where issuer supports it')+'; areas '+esc(row.areas.join(', '))+
    '<form method="POST" action="/api/owner/connect-mcp">'+
    '<input type="hidden" name="action" value="tools">'+
    '<input type="hidden" name="id" value="'+esc(row.id)+'">'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button>Verify remote tools</button></form>'+
    '<form method="POST" action="/api/owner/connect-mcp">'+
    '<input type="hidden" name="action" value="disconnect">'+
    '<input type="hidden" name="id" value="'+esc(row.id)+'">'+
    '<label>Type DISCONNECT <input name="confirm" required maxlength="10"></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button>Disconnect local Hub access</button></form></li>').join('')+'</ul>');
}
function listed(result){
 return shell('<h2>'+esc(result.server)+' — actual remote MCP tools</h2>'+
  '<p>This is a fresh authenticated provider read; no writes were sent. Mode: '+
   esc(result.mode)+'; profile: '+esc(result.profile)+'.</p><ul>'+
   result.tools.map(t=>'<li><code>'+esc(t.name)+'</code> — '+
    esc(t.description)+(t.readOnly?' (read-only)':'')+'</li>').join('')+'</ul>'+
   (result.incomplete?'<p>Only the first 30 tools are shown.</p>':'')+
   '<a href="/api/owner/connect-mcp">Return</a>');
}
function validateAction(fields){
 if(!fields||typeof fields.password!=='string'||!fields.password||
   fields.password.length>256||!['inspect','start','list','tools','disconnect'].includes(fields.action))
  return null;
 if(['tools','disconnect'].includes(fields.action))
  return uuid.test(fields.id||'')&&
   (fields.action!=='disconnect'||fields.confirm==='DISCONNECT')?{}:null;
 if(fields.action==='list')return {};
 if(typeof fields.origin!=='string'||fields.origin.length>255)return null;
 if(fields.action==='inspect')return {};
 if(!mode(fields.mode)||!profile(fields.profile)||
   typeof fields.areas!=='string'||fields.areas.length>2048||
   typeof fields.scopes!=='string'||fields.scopes.length>500||
   fields.family!==undefined&&(typeof fields.family!=='string'||fields.family.length>80))
  return null;
 const areas=fields.areas.split(',').map(x=>x.trim());
 if(!areas.length||areas.length>32||areas.some(x=>!slug.test(x))||
   new Set(areas).size!==areas.length)return null;
 const risk=fields.mode==='live'||fields.profile!=='read_only';
 if(risk && fields.risk_ack!=='I_AUTHORIZE'||!risk&&fields.risk_ack)return null;
 return {areas,risk};
}
export async function handleOwnerConnectMcp(req,res,{withDb,env=process.env,
 verify=verifyOwnerLogin,discover=discoverMcpOAuth,
 begin=beginUpstreamOauth,finish=finishUpstreamOauth,
 list=listUpstreamOauthConnections,tools=remoteConnectionRead,
 disconnect=disconnectUpstreamOauth}={}){
 htmlHeaders(res);res.setHeader('Pragma','no-cache');
 if(!['GET','POST'].includes(req.method))return res.status(405).send('Method not allowed');
 let hubOrigin;try{hubOrigin=publicHubOrigin(env);}
 catch{return res.status(503).send(shell('Hub setup is not configured'));}
 if(req.method==='GET')return res.status(200).send(form());
 if(!String(req.headers?.['content-type']||'').startsWith('application/x-www-form-urlencoded'))
  return res.status(415).send('Unsupported content type');
 const fields=formFields(req),parsed=validateAction(fields);
 if(!parsed)return res.status(400).send('Invalid MCP connection request');
 try{
  return await withDb(async(db,settings)=>{
   const approved=await verify(db,req,fields.password,{env});
   if(!approved.approved){
    if(approved.retryAfter)res.setHeader('Retry-After',String(approved.retryAfter));
    return res.status(approved.retryAfter?429:401).send('Owner verification refused');
   }
   if(fields.action==='list')return res.status(200).send(
      inventory(await list(db,env.HUB_OWNER_ID)));
   if(fields.action==='inspect')return res.status(200).send(
      consent(await discover(fields.origin)));
   if(fields.action==='tools')return res.status(200).send(
      listed(await tools(db,settings,{ownerId:env.HUB_OWNER_ID,id:fields.id})));
   if(fields.action==='disconnect'){
    const revoked=await disconnect(db,{ownerId:env.HUB_OWNER_ID,id:fields.id});
    return res.status(revoked?200:404).send(shell(revoked?
     'Hub connection locally disconnected. Revoke the grant at the original issuer too if needed.':
     'Connection already absent.'));
   }
   const started=await begin(db,settings,{ownerId:env.HUB_OWNER_ID,
    origin:fields.origin,hubOrigin,family:fields.family||null,
    mode:fields.mode,profile:fields.profile,areas:parsed.areas,
    scopes:fields.scopes,ack:parsed.risk});
   res.setHeader('Set-Cookie','hub_mcp_consent='+started.browserNonce+
    '; Path=/api/owner/connect-mcp-callback; Max-Age=600; HttpOnly; Secure; SameSite=Lax');
   res.setHeader('Location',started.authorizeUrl);
   return res.status(303).end();
  });
 }catch{return res.status(503).send(shell('MCP OAuth connection unavailable. '+
  'The existing provider connection was not changed.'));}
}
export async function handleOwnerMcpCallback(req,res,{withDb,env=process.env,
 finish=finishUpstreamOauth}={}){
 htmlHeaders(res);res.setHeader('Pragma','no-cache');
 if(req.method!=='GET')return res.status(405).send('Method not allowed');
 let hubOrigin;try{hubOrigin=publicHubOrigin(env);}
 catch{return res.status(503).send(shell('Hub setup unavailable'));}
 const query=req.query??{};
 const cookie=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(
  x=>x.startsWith('hub_mcp_consent='));
 const browser=cookie?.slice('hub_mcp_consent='.length)??'';
 if(Object.keys(query).some(k=>!['code','state','iss'].includes(k))||
   typeof query.code!=='string'||typeof query.state!=='string'||
   !/^[A-Za-z0-9_-]{43}$/.test(browser))
  return res.status(400).send(shell('Invalid or missing browser authorization state'));
 res.setHeader('Set-Cookie','hub_mcp_consent=; Path=/api/owner/connect-mcp-callback; '+
  'Max-Age=0; HttpOnly; Secure; SameSite=Lax');
 try{
  const result=await withDb((db,settings)=>finish(db,settings,{
   ownerId:env.HUB_OWNER_ID,hubOrigin,state:query.state,browser,code:query.code}));
  return res.status(200).send(shell('<h2>Connected '+esc(result.server)+'</h2>'+
   '<p>Provider OAuth authorization and real authenticated MCP tool discovery '+
   'succeeded. Tools discovered: '+esc(result.tools)+'. '+
   'Issuer refresh '+(result.refreshAvailable?'available':'not available')+'.</p>'+
   '<a href="/api/owner/connect-mcp">Manage connections</a>'));
 }catch{return res.status(503).send(shell('MCP OAuth verification refused or expired. '+
  'Existing connections remain unchanged; start a new consent flow.'));}
}
