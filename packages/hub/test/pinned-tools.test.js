import {EventEmitter} from 'node:events';
import {it,expect,vi} from 'vitest';
import {searchPinnedRtcTools,describePinnedRtcTool} from '../src/pinned-tools.js';
import {randomBytes} from 'node:crypto';

const pass='rtc_pass_'+randomBytes(32).toString('base64url');
const google={origin:'https://google-workspace-mcp.vercel.app',
  prefix:'google',areas:['gmail'],pass};
const stripe={origin:'https://stripe-mcp-psi.vercel.app',
  prefix:'stripe',areas:['billing'],pass};
const tool=(name,area)=>({name,area,description:'Read authorized test records',
  profiles:['read_only','full'],writes:false,money:false,destructive:false,
  annotations:{readOnlyHint:true},inputSchema:{type:'object',properties:{limit:{type:'integer'}}}});
function transportFor(reply,{answers=[{address:'8.8.8.8',family:4}],modern=true}={}) {
 const calls=[];
 const lookup=vi.fn((_host,_opt,cb)=>cb(null,answers));
 const request=vi.fn((options,onResponse)=>{
  calls.push(options);
  const req=new EventEmitter();
  req.setTimeout=vi.fn();req.destroy=vi.fn();
  req.end=()=>options.lookup(options.hostname,{all:modern},(err,resolved,family)=>{
   if(!err&&modern&&(!Array.isArray(resolved)||resolved.length!==1||resolved[0].family!==4))err=new Error('modern Node DNS list required');
   if(!err&&!modern&&(typeof resolved!=='string'||family!==4))err=new Error('legacy Node DNS address required');
   if(err){queueMicrotask(()=>req.emit('error',err));return;}
   queueMicrotask(()=>{
    const res=new EventEmitter();res.statusCode=200;
    res.headers={'content-type':'application/json'};
    onResponse(res);
    const data=JSON.stringify(typeof reply==='function'?reply(options):reply);
    res.emit('data',Buffer.from(data));res.emit('end');
   });
  });
  return req;
 });
 return {lookup,request,calls};
}
it('searches distinct RTC services through scoped DNS-pinned HTTPS and no write dispatch',async()=>{
 const g=transportFor({ok:true,result:{tools:[tool('google_gmail_list','gmail')],
   next:null}});
 const s=transportFor({ok:true,result:{tools:[tool('stripe_invoice_list','billing')],
   next:'opaque-next'}});
 const a=await searchPinnedRtcTools(google,{query:'list',area:'gmail',limit:2},g);
 const b=await searchPinnedRtcTools(stripe,{query:'invoice',area:'billing',limit:2},s);
 expect(a.tools.map(x=>x.name)).toEqual(['google_gmail_list']);
 expect(b.tools.map(x=>x.name)).toEqual(['stripe_invoice_list']);
 expect(b.incomplete).toBe(true);
 for(const t of [g,s]){
  expect(t.calls).toHaveLength(1);
  expect(t.calls[0]).toMatchObject({method:'GET',agent:false,port:443,rejectUnauthorized:true});
  expect(t.calls[0].headers.authorization).toBe('Bearer '+pass);
  expect(t.calls[0].path).toMatch(/^\/api\/tools\?/);
 }
 expect(g.calls[0].hostname).toBe('google-workspace-mcp.vercel.app');
 expect(s.calls[0].hostname).toBe('stripe-mcp-psi.vercel.app');
 expect(JSON.stringify(a)).not.toContain(pass);
});
it('retrieves exact schema only on demand with canonical prefix ownership',async()=>{
 const t=transportFor({ok:true,result:tool('google_gmail_list','gmail')});
 const schema=await describePinnedRtcTool(google,'google_gmail_list',t);
 expect(schema.inputSchema.properties.limit.type).toBe('integer');
 expect(t.calls[0].path).toBe('/api/tools/google_gmail_list');
 await expect(describePinnedRtcTool(google,'stripe_invoice_list',t)).rejects.toThrow();
 expect(t.calls).toHaveLength(1);
});
it('rejects writes, unknown prefixes, outside-grant areas and excessive search sizes',async()=>{
 const writes=transportFor({ok:true,result:{tools:[{
  ...tool('stripe_invoice_list','billing'),writes:true}],next:null}});
 expect((await searchPinnedRtcTools(stripe,{limit:3},writes)).tools).toEqual([]);
 const escape=transportFor({ok:true,result:{tools:[
  tool('google_gmail_list','gmail')],next:null}});
 await expect(searchPinnedRtcTools(stripe,{},escape)).rejects.toThrow();
 const outside=transportFor({ok:true,result:{tools:[
  tool('stripe_admin_accounts','admin')],next:null}});
 expect((await searchPinnedRtcTools(stripe,{},outside)).tools).toEqual([]);
 await expect(searchPinnedRtcTools(stripe,{area:'admin'},outside)).rejects.toThrow();
 await expect(searchPinnedRtcTools(stripe,{limit:21},outside)).rejects.toThrow();
 const duplicate=transportFor({ok:true,result:{tools:Array(21).fill(
  tool('stripe_invoice_list','billing')),next:null}});
 await expect(searchPinnedRtcTools(stripe,{limit:20},duplicate)).rejects.toThrow();
});
it('prevents SSRF rebinding and fails closed on malformed schema and unsafe paths',async()=>{
 const dns=transportFor({ok:true,result:{tools:[],next:null}},
  {answers:[{address:'169.254.169.254',family:4}]});
 await expect(searchPinnedRtcTools(stripe,{},dns)).rejects.toThrow();
 expect(dns.request).toHaveBeenCalledTimes(1);
 const malformed=transportFor({ok:true,result:{...tool('stripe_invoice_list','billing'),
   inputSchema:'not-schema'}});
 await expect(describePinnedRtcTool(stripe,'stripe_invoice_list',malformed)).rejects.toThrow();
 const notFound=transportFor({ok:false,error:{code:'permission'}});
 await expect(describePinnedRtcTool(stripe,'stripe_invoice_list',notFound)).rejects.toThrow();
 const unsafe=transportFor({ok:true,result:tool('stripe_invoice_list','billing')});
 await expect(describePinnedRtcTool(stripe,'stripe_invoice_list?x=1',unsafe)).rejects.toThrow();
 expect(unsafe.calls).toHaveLength(0);
});


it('uses already-delimited workspace_ RTC prefix without adding another separator',async()=>{
 const workspace={...google,prefix:'workspace_'};
 const t=transportFor({ok:true,result:{tools:[
  tool('workspace_drive_list','gmail')],next:null}});
 const found=await searchPinnedRtcTools(workspace,{query:'drive'},t);
 expect(found.tools.map(x=>x.name)).toEqual(['workspace_drive_list']);
 const schema=transportFor({ok:true,result:tool('workspace_drive_list','gmail')});
 expect((await describePinnedRtcTool(workspace,'workspace_drive_list',schema)).name)
  .toBe('workspace_drive_list');
 expect(schema.calls[0].path).toBe('/api/tools/workspace_drive_list');
 const malformed=transportFor({ok:true,result:{tools:[
  tool('workspace__drive_list','gmail')],next:null}});
 await expect(searchPinnedRtcTools(workspace,{query:'drive'},malformed))
  .rejects.toThrow();
 await expect(describePinnedRtcTool(workspace,'workspace__drive_list',schema))
  .rejects.toThrow();
 expect(schema.calls).toHaveLength(1);
});

it('resumes bounded pinned RTC next pages without extra host, path or credential reach',async()=>{
 const t=transportFor(options=>({
  ok:true,result:options.path.includes('cursor=page_2')?
    {tools:[tool('stripe_invoice_detail','billing')],next:null}:
    {tools:[tool('stripe_invoice_list','billing')],next:'page_2'}
 }));
 const first=await searchPinnedRtcTools(stripe,{query:'invoice',limit:2},t);
 expect(first.next).toEqual({kind:'cursor',value:'page_2'});
 expect(first.incomplete).toBe(true);
 const second=await searchPinnedRtcTools(stripe,
  {query:'invoice',limit:2,cursor:first.next},t);
 expect(second.tools.map(x=>x.name)).toEqual(['stripe_invoice_detail']);
 expect(second.next).toBeNull();
 expect(t.calls.map(c=>c.path)).toEqual([
  '/api/tools?q=invoice&limit=2',
  '/api/tools?q=invoice&limit=2&cursor=page_2'
 ]);
 expect(t.calls.every(c=>c.method==='GET'&&c.rejectUnauthorized===true)).toBe(true);
 expect(t.calls.every(c=>c.headers.authorization==='Bearer '+pass)).toBe(true);
 for(const cursor of ['https://bad.example','../../admin','x'.repeat(129),'has space']){
  await expect(searchPinnedRtcTools(stripe,{cursor:{kind:'cursor',value:cursor}},t)).rejects.toThrow();
 }
 expect(t.calls).toHaveLength(2);
});
it('refuses malformed and oversized next-page tokens without exposing unsafe metadata',async()=>{
 for(const next of [{url:'https://bad'},'../admin','x'.repeat(129),'space here',-1,100001,1.5]){
  const t=transportFor({ok:true,result:{tools:[tool('stripe_invoice_list','billing')],next}});
  await expect(searchPinnedRtcTools(stripe,{query:'invoice'},t)).rejects.toThrow();
 }
});

it('follows observed Stripe numeric-offset and Workspace decimal-page RTC1 replies without provider-name branching',async()=>{
 const s=transportFor(options=>({ok:true,result:options.path.includes('offset=2')?
  {tools:[tool('stripe_invoice_detail','billing')],total:3,offset:2,next:null}:
  {tools:[tool('stripe_invoice_list','billing')],total:3,offset:0,next:2}}));
 const firstStripe=await searchPinnedRtcTools(stripe,{query:'invoice',limit:2},s);
 expect(firstStripe.next).toEqual({kind:'offset',value:'2'});
 const secondStripe=await searchPinnedRtcTools(stripe,
  {query:'invoice',limit:2,cursor:firstStripe.next},s);
 expect(secondStripe.tools.map(t=>t.name)).toEqual(['stripe_invoice_detail']);
 expect(secondStripe.next).toBeNull();
 expect(s.calls.map(x=>x.path)).toEqual([
  '/api/tools?q=invoice&limit=2',
  '/api/tools?q=invoice&limit=2&offset=2'
 ]);
 const w=transportFor(options=>({ok:true,result:options.path.includes('page=2')?
  {tools:[tool('google_gmail_get','gmail')],next:null}:
  {tools:[tool('google_gmail_list','gmail')],next:'2'}}));
 const firstWorkspace=await searchPinnedRtcTools(google,{query:'gmail',limit:2},w);
 expect(firstWorkspace.next).toEqual({kind:'page',value:'2'});
 const secondWorkspace=await searchPinnedRtcTools(google,
  {query:'gmail',limit:2,cursor:firstWorkspace.next},w);
 expect(secondWorkspace.tools.map(t=>t.name)).toEqual(['google_gmail_get']);
 expect(secondWorkspace.next).toBeNull();
 expect(w.calls.map(x=>x.path)).toEqual([
  '/api/tools?q=gmail&limit=2',
  '/api/tools?q=gmail&limit=2&page=2'
 ]);
 expect([...w.calls,...s.calls].every(x=>x.method==='GET'&&x.rejectUnauthorized))
  .toBe(true);
});
it('refuses malformed or ambiguous typed RTC selectors before network dispatch',async()=>{
 const t=transportFor({ok:true,result:{tools:[],next:null}});
 for(const cursor of [
  {kind:'offset',value:'0'},{kind:'offset',value:'100001'},
  {kind:'page',value:'notnumeric'},{kind:'page',value:'1.5'},
  {kind:'other',value:'1'},{kind:'cursor',value:'../admin'},
  {kind:'page',value:'2',offset:'1'}
 ]) await expect(searchPinnedRtcTools(google,{cursor},t)).rejects.toThrow();
 expect(t.calls).toHaveLength(0);
});

it('realistic Node modern lookup shape works for service discovery and exact schema',async()=>{
 for(const modern of [true,false]){
  const listed=transportFor({ok:true,result:{tools:[tool('stripe_invoice_list','billing')],next:null}},{modern});
  const rows=await searchPinnedRtcTools(stripe,{limit:2},listed);
  expect(rows.tools.map(t=>t.name)).toEqual(['stripe_invoice_list']);
  const described=transportFor({ok:true,result:tool('stripe_invoice_list','billing')},{modern});
  expect((await describePinnedRtcTool(stripe,'stripe_invoice_list',described)).name).toBe('stripe_invoice_list');
 }
});

it('discovers authorized nonwriting metadata for a LIVE full-profile service without extra provider handlers',async()=>{
 const full={...google,profile:'full',mode:'live'};
 const t=transportFor({ok:true,result:{tools:[tool('google_gmail_list','gmail')],next:null}});
 const output=await searchPinnedRtcTools(full,{query:'gmail'},t);
 expect(output.tools).toEqual([expect.objectContaining({
  name:'google_gmail_list',profiles:['full'],writes:false})]);
 const dangerous=transportFor({ok:true,result:{tools:[
  {...tool('google_gmail_list','gmail'),writes:true}],next:null}});
 expect((await searchPinnedRtcTools(full,{query:'gmail'},dangerous)).tools).toEqual([]);
});
