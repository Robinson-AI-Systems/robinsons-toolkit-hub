import {randomUUID} from 'node:crypto';
import {it,expect,vi} from 'vitest';
import {runFederatedBroker} from '../src/federation.js';
import {mcpFederatedReply} from '../src/http-door.js';
import {handleHubTools} from '../src/tools-http.js';
import {issueSearchCursor,searchCursorScope} from '../src/search-cursor.js';
import {issueFleetCursor,maxFleetDepth} from '../src/fleet-cursor.js';

const actor={id:randomUUID(),ownerId:'fixture-owner',clientId:'fixture-app',
 mode:'test',profile:'full',areas:['gateway'],allowWrites:false};
const settings={pepper:'fixture-fleet-mcp-https-key-longer-than-32'};
const roster=n=>Array.from({length:n},(_,i)=>({
 name:'svc'+String(i).padStart(3,'0'),prefix:'svc'+String(i).padStart(3,'0'),
 areas:['billing'],grantId:'verified-grant-'+i,
 origin:'https://rtc'+i+'.example.net',verifiedAt:'2026-10-14T00:00:00Z'
}));
const filters={query:'invoice',area:'billing',limit:3};
function fixture(n=5) {
 const targets=roster(n);
 const list=vi.fn(async()=>targets);
 const resolve=vi.fn(async(_db,{serverName})=>{
  const t=targets.find(t=>t.name===serverName);
  return t?{server:t.name,prefix:t.prefix,origin:t.origin,grantId:t.grantId,
   areas:[...t.areas],mode:'test',profile:'read_only',pass:'never-export-fixture'}:null;
 });
 const search=vi.fn(async(grant,args)=>{
  if(args.limit!==1)throw new Error('Broad catalogue must make one-result pages');
  const style=Number(grant.server.slice(-3))%3;
  let page=0;
  if(args.cursor) {
   if(style===0&&args.cursor.kind==='offset')page=Number(args.cursor.value);
   else if(style===1&&args.cursor.kind==='page')page=Number(args.cursor.value)-1;
   else if(style===2&&args.cursor.kind==='cursor')
    page=args.cursor.value==='private_second_page'?1:2;
   else throw new Error('Wrong RTC provider page selector');
  }
  if(page>2)throw new Error('Provider page overrun');
  const next=page>=2?null:style===0?{kind:'offset',value:String(page+1)}:
   style===1?{kind:'page',value:String(page+2)}:
   {kind:'cursor',value:page===0?'private_second_page':'private_third_page'};
  return {tools:[{name:grant.prefix+'_invoice_'+page,area:'billing',
   description:'Safe authorized RTC read',writes:false,money:false,
   destructive:false,annotations:{readOnlyHint:true}}],next,incomplete:next!==null};
 });
 return {targets,deps:{list,resolve,search},list,resolve,search};
}

it('completes all real per-provider pages across 5 services without requiring separate searches',async()=>{
 const {deps,search,resolve}=fixture(5),seen=new Set(),history=[];
 let cursor=null;
 for(let step=0;step<30;step++){
  const reply=await runFederatedBroker('hub_search_tools',
   {...filters,...(cursor?{cursor}:{})},actor,{},settings,deps);
  expect(reply.ok).toBe(true);
  expect(reply.result.scanned).toBeLessThanOrEqual(3);
  expect(reply.result.tools.length).toBeLessThanOrEqual(filters.limit);
  expect(Buffer.byteLength(JSON.stringify(reply.result),'utf8')).toBeLessThan(8192);
  for(const entry of reply.result.tools){
   if(entry.server){
    expect(seen.has(entry.name)).toBe(false);
    seen.add(entry.name);
   }
  }
  history.push(reply.result);
  cursor=reply.result.next;
  if(!cursor)break;
  // Provider queues are sealed; once drained, the older signed service
  // offset cursor remains the smaller backwards-compatible continuation.
  expect(cursor.startsWith('f.')||/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor)).toBe(true);
  expect(cursor).not.toContain('private_second_page');
  expect(cursor.length).toBeLessThanOrEqual(1280);
 }
 expect(seen.size).toBe(15);
 expect(history).toHaveLength(6);
 expect(history.at(-1).incomplete).toBe(false);
 expect(search).toHaveBeenCalledTimes(15);
 expect(resolve).toHaveBeenCalledTimes(30);
 expect(search.mock.calls.every(([,args])=>args.limit===1)).toBe(true);
});

it('retains the 100-service, three-GET fanout with 300 actually reachable entries',async()=>{
 const {deps,search}=fixture(100);
 let next=null,pages=0;const names=new Set();
 do {
  const r=await runFederatedBroker('hub_search_tools',
   {...filters,...(next?{cursor:next}:{})},actor,{},settings,deps);
  expect(r.ok).toBe(true);
  expect(r.result.scanned).toBeLessThanOrEqual(3);
  expect(r.result.authorizedTargets).toBe(100);
  for(const entry of r.result.tools)if(entry.server)names.add(entry.name);
  next=r.result.next;pages++;
  expect(pages).toBeLessThanOrEqual(103);
 }while(next);
 expect(names.size).toBe(300);
 expect(search).toHaveBeenCalledTimes(300);
 expect(pages).toBe(102);
});

it('rejects forgery, different filters, rotated grants and service destinations before upstream reads',async()=>{
 const {targets,deps,search}=fixture(5);
 const first=await runFederatedBroker('hub_search_tools',filters,actor,{},settings,deps);
 expect(first.result.next).toMatch(/^f\./);
 search.mockClear();
 for(const args of [
  {...filters,cursor:first.result.next.slice(0,-1)+'*'},
  {...filters,query:'changed',cursor:first.result.next},
  {...filters,area:'other',cursor:first.result.next}
 ]){
  const refused=await runFederatedBroker('hub_search_tools',args,actor,{},settings,deps);
  expect(refused.ok).toBe(false);
 }
 const otherActor=await runFederatedBroker('hub_search_tools',
  {...filters,cursor:first.result.next},{...actor,id:randomUUID()}, {},settings,deps);
 expect(otherActor.error.code).toBe('invalid_args');
 const original=targets[1];
 for(const change of [
  {grantId:'new-grant'}, {origin:'https://changed.example.net'},
  {verifiedAt:'2026-10-14T00:10:00Z'}
 ]){
  targets[1]={...original,...change};
  const stale=await runFederatedBroker('hub_search_tools',
   {...filters,cursor:first.result.next},actor,{},settings,deps);
  expect(stale.error.code).toBe('invalid_args');
 }
 expect(search).not.toHaveBeenCalled();
});

it('isolates provider outage without losing healthy provider continuation',async()=>{
 const {deps,search}=fixture(3);
 const original=search.getMockImplementation();
 search.mockImplementation(async(grant,args)=>{
  if(grant.server==='svc001')throw new Error('provider secret unavailable');
  return original(grant,args);
 });
 const first=await runFederatedBroker('hub_search_tools',filters,actor,{},settings,deps);
 expect(first.ok).toBe(true);
 expect(first.result.failures).toEqual([{server:'svc001',code:'unavailable'}]);
 expect(first.result.tools.map(x=>x.server)).toContain('svc000');
 expect(first.result.tools.map(x=>x.server)).toContain('svc002');
 expect(first.result.next).toMatch(/^f\./);
 let cursor=first.result.next;
 for(let i=0;i<3&&cursor;i++){
  const step=await runFederatedBroker('hub_search_tools',
   {...filters,cursor},actor,{},settings,deps);
  expect(step.ok).toBe(true);
  cursor=step.result.next;
 }
 expect(cursor).toBeNull();
 expect(search.mock.calls.filter(([grant])=>grant.server==='svc001')).toHaveLength(1);
});

it('keeps legacy signed service cursors and rejects crossing between focused and broad cursors',async()=>{
 const {targets,deps,search}=fixture(5);
 const scope=searchCursorScope(actor,filters,targets);
 const old=issueSearchCursor(scope,3,settings);
 const resumed=await runFederatedBroker('hub_search_tools',
  {...filters,cursor:old},actor,{},settings,deps);
 expect(resumed.ok).toBe(true);
 expect(resumed.result.tools.filter(x=>x.server).map(x=>x.server))
  .toEqual(['svc003','svc004']);
 expect(resumed.result.next).toMatch(/^f\./);
 const cross=await runFederatedBroker('hub_search_tools',
  {...filters,server:'svc003',cursor:resumed.result.next},actor,{},settings,deps);
 expect(cross.error.code).toBe('invalid_args');
 expect(search).toHaveBeenCalledTimes(2);
});

it('bounds deep hostile-but-valid upstream pagination at 1000 pages per service',async()=>{
 const {targets,deps}=fixture(1);
 const scope=searchCursorScope(actor,filters,targets);
 const token=issueFleetCursor(scope,{o:1,p:[{
  i:0,n:{kind:'offset',value:'1'},d:maxFleetDepth
 }]},settings);
 const r=await runFederatedBroker('hub_search_tools',
  {...filters,cursor:token},actor,{},settings,deps);
 expect(r.ok).toBe(true);
 expect(r.result.next).toBeNull();
 expect(r.result.incomplete).toBe(true);
 expect(r.result.scanned).toBe(1);
});

it('native MCP caller and authenticated HTTPS caller both traverse the identical private queue',async()=>{
 const {deps,search}=fixture(2),args={...filters,limit:2};
 const first=await mcpFederatedReply({jsonrpc:'2.0',id:1,method:'tools/call',
  params:{name:'hub_search_tools',arguments:args}},actor,{},settings,deps);
 expect(first.error).toBeUndefined();
 const cursor=first.result.structuredContent.next;
 expect(cursor).toMatch(/^f\./);
 const authorize=vi.fn(async()=>({actor}));
 const res={code:200,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.code=n;return this;},
  json(b){this.body=b;return this;}};
 await handleHubTools({method:'GET',
  query:{q:args.query,area:args.area,limit:String(args.limit),cursor},
  headers:{authorization:'synthetic-authorization'}},res,{
  withDb:async(fn)=>fn({},settings),authorize,
  federate:(name,params,a,db,s)=>runFederatedBroker(name,params,a,db,s,deps)
 },'list');
 expect(res.code).toBe(200);
 expect(res.body.result.next).toMatch(/^f\./);
 expect(res.body.result.tools.every(t=>t.name.endsWith('_invoice_1'))).toBe(true);
 expect(search).toHaveBeenCalledTimes(4);
 expect(JSON.stringify([first,res.body])).not.toContain('private_second_page');
 expect(JSON.stringify([first,res.body])).not.toContain('never-export-fixture');
 expect(res.headers['Cache-Control']).toBe('no-store');
});
