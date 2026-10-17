import {EventEmitter} from 'node:events';
import {randomBytes} from 'node:crypto';
import {it,expect,vi} from 'vitest';
import {pinnedRtcReadCall} from '../src/pinned-read-call.js';
const pass='rtc_pass_'+randomBytes(32).toString('base64url');
const target={server:'stripe',prefix:'stripe',profile:'read_only',
 mode:'test',origin:'https://stripe-mcp-psi.vercel.app',
 pass,areas:['billing']};
function channel({answers=[{address:'8.8.8.8',family:4}],
 modern=true,status=200,mime='application/json',result={ok:true,result:{items:[]}}}={}) {
 const requests=[];
 const lookup=vi.fn((_host,_options,cb)=>cb(null,answers));
 const request=vi.fn((options,onResponse)=>{
  const req=new EventEmitter();
  req.setTimeout=vi.fn();req.destroy=vi.fn();
  req.end=body=>{
   requests.push({options,body});
   options.lookup(options.hostname,{all:modern},(err,resolved,family)=>{
    if(!err&&modern&&(!Array.isArray(resolved)||resolved.length!==1||resolved[0].family!==4))err=new Error('modern Node array lookup required');
    if(!err&&!modern&&(typeof resolved!=='string'||family!==4))err=new Error('legacy Node DNS address required');
    if(err){queueMicrotask(()=>req.emit('error',err));return;}
    queueMicrotask(()=>{
     const res=new EventEmitter();res.statusCode=status;
     res.headers={'content-type':mime};res.resume=vi.fn();
     onResponse(res);
     if([200,400,401,403,404,409,422,429].includes(status)&&mime==='application/json'){
      res.emit('data',Buffer.from(JSON.stringify(result)));
      res.emit('end');
     }
    });
   });
  };
  return req;
 });
 return {lookup,request,requests};
}
it('performs one pinned HTTPS authorized RTC read with exact name and no retry',async()=>{
 const fake=channel();
 const result=await pinnedRtcReadCall(target,'stripe_invoice_list',
  {limit:2},fake);
 expect(result).toEqual({ok:true,result:{items:[]}});
 expect(fake.requests).toHaveLength(1);
 expect(fake.requests[0].options).toMatchObject({
  method:'POST',hostname:'stripe-mcp-psi.vercel.app',port:443,
  protocol:'https:',agent:false,rejectUnauthorized:true,
  path:'/api/tools/stripe_invoice_list'});
 expect(fake.requests[0].options.headers.authorization).toBe('Bearer '+pass);
 expect(JSON.parse(fake.requests[0].body)).toEqual({limit:2});
});
it('rejects DNS rebinding before connected socket and does not retry',async()=>{
 const fake=channel({answers:[{address:'169.254.169.254',family:4}]});
 await expect(pinnedRtcReadCall(target,'stripe_invoice_list',{},fake))
  .rejects.toThrow('do not automatically retry');
 expect(fake.requests).toHaveLength(1);
 expect(fake.request).toHaveBeenCalledTimes(1);
});
it('refuses malformed profiles, unknown modes, cross-prefix calls and huge payloads',async()=>{
 const fake=channel();
 for(const t of [{...target,profile:'unknown'},{...target,mode:'production'},
  {...target,origin:'https://127.0.0.1'}]){
  await expect(pinnedRtcReadCall(t,'stripe_invoice_list',{},fake)).rejects.toThrow();
 }
 await expect(pinnedRtcReadCall(target,'github_repo_list',{},fake)).rejects.toThrow();
 await expect(pinnedRtcReadCall(target,'stripe_invoice_list',
  {large:'x'.repeat(9000)},fake)).rejects.toThrow();
 expect(fake.request).toHaveBeenCalledTimes(0);
});
it('does not return redirects or unexpected HTML as successful read',async()=>{
 for(const setup of [{status:302,mime:'text/html'},
  {status:200,mime:'text/html'},{result:{ok:'bad',result:{}}}]){
  const fake=channel(setup);
  await expect(pinnedRtcReadCall(target,'stripe_invoice_list',{},fake))
   .rejects.toThrow('do not automatically retry');
  expect(fake.request).toHaveBeenCalledTimes(1);
 }
});

it('preserves an authenticated RTC 403 refusal without interpreting it as a successful read',async()=>{
 const fake=channel({status:403,result:{ok:false,
  error:{code:'outside_scope',what:'not authorized'}}});
 const response=await pinnedRtcReadCall(target,'stripe_invoice_list',{},fake);
 expect(response).toMatchObject({ok:false,error:{code:'outside_scope'}});
 expect(fake.requests).toHaveLength(1);
});

it('accepts a bounded large RTC read but rejects responses above the envelope without replay',async()=>{
 const accepted=channel({result:{ok:true,result:{items:'a'.repeat(50000)}}});
 const out=await pinnedRtcReadCall(target,'stripe_invoice_list',{},accepted);
 expect(out.result.items).toHaveLength(50000);
 expect(accepted.requests).toHaveLength(1);
 const refused=channel({result:{ok:true,result:{items:'b'.repeat(71000)}}});
 await expect(pinnedRtcReadCall(target,'stripe_invoice_list',{},refused))
  .rejects.toThrow('do not automatically retry');
 expect(refused.requests).toHaveLength(1);
});


it('dispatches a canonical trailing-underscore workspace tool once and rejects doubled separators',async()=>{
 const workspace={...target,server:'google-workspace',prefix:'workspace_'};
 const fake=channel();
 const reply=await pinnedRtcReadCall(workspace,'workspace_drive_list',{limit:1},fake);
 expect(reply.ok).toBe(true);
 expect(fake.requests[0].options.path).toBe('/api/tools/workspace_drive_list');
 await expect(pinnedRtcReadCall(workspace,'workspace__drive_list',{},fake))
  .rejects.toThrow();
 await expect(pinnedRtcReadCall(workspace,'stripe_invoice_list',{},fake))
  .rejects.toThrow();
 expect(fake.requests).toHaveLength(1);
});

it('realistic modern and legacy Node lookup response both permit one scoped POST',async()=>{
 for(const modern of [true,false]){
  const fake=channel({modern});
  const result=await pinnedRtcReadCall(target,'stripe_invoice_list',{limit:1},fake);
  expect(result.ok).toBe(true);
  expect(fake.requests).toHaveLength(1);
 }
});
it('mixed private/public DNS fails closed for both Node DNS modes before POST delivery',async()=>{
 for(const modern of [true,false]){
  const fake=channel({modern,answers:[{address:'8.8.8.8',family:4},{address:'10.0.0.9',family:4}]});
  await expect(pinnedRtcReadCall(target,'stripe_invoice_list',{},fake)).rejects.toThrow('do not automatically retry');
 }
});
