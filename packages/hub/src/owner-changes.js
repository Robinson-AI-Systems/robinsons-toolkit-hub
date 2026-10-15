// H-5: private, bounded owner readback of the exact durable H-3 receipts.
// Every POST needs fresh independent password/SQL rate-limit verification.
import {escapeHtml,formFields,htmlHeaders,publicHubOrigin,
 verifyOwnerLogin} from './owner-login.js';
import {listHubRecentChanges} from './recent-changes.js';
const e=value=>escapeHtml(value??'');
const layout=body=>'<!doctype html><html lang="en"><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>Hub recent changes</title><main><h1>RTC routed read history</h1>'+
 '<p>Hub-side immutable TEST receipts, not provider change acceptance. '+
 'No LIVE operation or provider call is performed by this page.</p>'+
 '<p><a href="/api/owner/dashboard">Back to owner control center</a></p>'+
 body+'</main></html>';
const form=(cursor='',server='')=>'<form method="POST" action="/api/owner/changes">'+
 '<label>Filter by registered service name (optional) '+
 '<input name="server" maxlength="59" value="'+e(server)+'"></label>'+
 (cursor?'<input type="hidden" name="cursor" value="'+e(cursor)+'">':'')+
 '<label>Owner passphrase (independent approval each page) '+
 '<input type="password" name="password" autocomplete="current-password"'+
 ' maxlength="256" required></label>'+
 '<button type="submit">Show private history</button></form>';
export function renderOwnerChanges(result,server=''){
 const rows=result.changes.map(item=>'<li><details><summary>'+
    e(item.at instanceof Date?item.at.toISOString():String(item.at))+
    ' — '+e(item.server)+' — '+e(item.outcome)+'</summary>'+
    '<p>Caller: '+e(item.connection)+' '+e(item.callerId)+
    '; tool: '+e(item.tool)+'</p>'+
    '<p>'+e(item.summary)+'</p>'+
    '<p>Correlation: '+e(item.correlationId)+
    '; upstream log ID: '+e(item.serverLogId??'not supplied')+'</p>'+
    '</details></li>').join('');
 const body='<p>Showing '+e(result.count)+' Hub audit entries. No pass, provider '+
  'credential, arguments, result body or sensitive source logs are shown.</p>'+
  '<ul>'+rows+'</ul>'+(result.changes.length===0?
    '<p>No records within this owned, bounded view.</p>':'')+
  (result.next?'<h2>Older history</h2>'+form(result.next,server):
    '<p>No older page available within the selected scope.</p>')+
  '<p>Filter differently: reopen this page and independently authenticate.</p>';
 const html=layout(body);
 if(Buffer.byteLength(html,'utf8')>64000)
   throw new Error('Hub owner history exceeds bounded display');
 return html;
}
export async function handleOwnerChanges(req,res,
 {withDb,env=process.env,verify=verifyOwnerLogin,
 read=listHubRecentChanges}={}){
 htmlHeaders(res);
 res.setHeader('Pragma','no-cache');
 if(!['GET','POST'].includes(req.method)){
   res.setHeader('Allow','GET, POST');
   return res.status(405).send('Method not allowed');
 }
 try{publicHubOrigin(env);}catch{
   return res.status(503).send('Owner history unavailable');
 }
 if(req.method==='GET')
   return res.status(200).send(layout(form()+
     '<p>History is queried only after verified owner approval.</p>'));
 if(!String(req.headers?.['content-type']||'').startsWith(
   'application/x-www-form-urlencoded'))
   return res.status(415).send('Unsupported content type');
 const fields=formFields(req);
 if(!fields||Object.keys(fields).some(k=>
   !['server','cursor','password'].includes(k))||
   typeof fields.password!=='string'||!fields.password||
   fields.password.length>256)return res.status(400).send('Invalid history request');
 const serverName=fields.server||null,cursor=fields.cursor||null;
 if((serverName!==null&&!/^[a-z][a-z0-9_]{1,59}$/.test(serverName))||
   (cursor!==null&&(typeof cursor!=='string'||cursor.length>540)))
   return res.status(400).send('Invalid history scope');
 try{
   return await withDb(async(db,settings)=>{
     const verified=await verify(db,req,fields.password,{env});
     if(!verified.approved){
       if(verified.retryAfter)res.setHeader('Retry-After',String(verified.retryAfter));
       return res.status(verified.retryAfter?429:401).send('Owner verification denied');
     }
     let result;
     try{
       result=await read(db,{ownerId:env.HUB_OWNER_ID,
         serverName,cursor,limit:20},settings,{ownerVerified:true});
     }catch(error){
       if(error instanceof TypeError)return res.status(400).send('Invalid or expired history cursor');
       throw error;
     }
     return res.status(200).send(renderOwnerChanges(result,serverName??''));
   });
 }catch{return res.status(503).send('Hub history unavailable');}
}
