import {randomUUID} from 'node:crypto';
import {it,expect,vi} from 'vitest';
import {runFederatedBroker} from '../src/federation.js';
import {mcpFederatedReply} from '../src/http-door.js';

const actor={id:randomUUID(),ownerId:'owner-fixture',clientId:'developer',
 profile:'full',mode:'test',areas:['gateway'],allowWrites:false};
const settings={pepper:'synthetic-hub-namespace-cursor-signing-32-bytes'};
const roster=n=>Array.from({length:n},(_,i)=>({
 name:'svc'+String(i).padStart(3,'0'),
 prefix:'svc'+String(i).padStart(3,'0'),areas:['gateway'],
 claimedCounts:{tools:100},readOnlyGrant:true}));
const make=members=>({
 list:vi.fn(async()=>members),
 resolve:vi.fn(),search:vi.fn(),describe:vi.fn(),read:vi.fn(),audit:vi.fn()
});
it('browses 2/5/12/50/100 authorized namespaces without any upstream calls',async()=>{
 for(const n of [2,5,12,50,100]) {
  const deps=make(roster(n)),results=[],all=new Set();
  let next,rounds=0;
  do {
   const r=await mcpFederatedReply({jsonrpc:'2.0',id:rounds+1,
    method:'tools/call',params:{name:'hub_namespaces',
      arguments:{limit:10,...(next?{cursor:next}:{})}}},
    actor,{},settings,deps);
   expect(r.error).toBeUndefined();
   const page=r.result.structuredContent;
   expect(Buffer.byteLength(JSON.stringify(r),'utf8')).toBeLessThan(8192);
   expect(page.authorizedTargets).toBe(n);
   expect(page.metadataOnly).toBe(true);
   results.push(page);
   for(const x of page.namespaces) {
    expect(all.has(x.name)).toBe(false);
    all.add(x.name);
   }
   next=page.next;
   rounds++;
   expect(rounds).toBeLessThanOrEqual(10);
  } while(next);
  expect([...all].filter(x=>x!=='hub').length).toBe(n);
  expect(all.has('hub')).toBe(true);
  expect(results).toHaveLength(Math.ceil(n/10));
  expect(deps.resolve).not.toHaveBeenCalled();
  expect(deps.search).not.toHaveBeenCalled();
  expect(deps.describe).not.toHaveBeenCalled();
  expect(deps.read).not.toHaveBeenCalled();
 }
});
it('supports one-namespace pages and truthful 100-service health',async()=>{
 const deps=make(roster(100));
 let cursor,seen=0;
 do {
  const r=await runFederatedBroker('hub_namespaces',
   {limit:1,...(cursor?{cursor}:{})},actor,{},settings,deps);
  expect(r.ok).toBe(true);
  seen+=r.result.namespaces.filter(x=>x.name!=='hub').length;
  cursor=r.result.next;
 }while(cursor);
 expect(seen).toBe(100);
 const health=await runFederatedBroker('hub_health',{},actor,{},settings,deps);
 expect(health.result.accessibleUpstreams).toBe(100);
 expect(deps.list).toHaveBeenCalledWith(expect.anything(),actor,{limit:100});
});
it('denies replay after caller change or eligible namespace roster change',async()=>{
 const deps=make(roster(12));
 const first=await runFederatedBroker('hub_namespaces',{},actor,{},settings,deps);
 expect(first.ok).toBe(true);
 expect(typeof first.result.next).toBe('string');
 const replaced=await runFederatedBroker('hub_namespaces',
  {cursor:first.result.next},{...actor,id:randomUUID()}, {},settings,deps);
 expect(replaced.error.code).toBe('invalid_args');
 const retired=make(roster(11));
 const denied=await runFederatedBroker('hub_namespaces',
  {cursor:first.result.next},actor,{},settings,retired);
 expect(denied.error.code).toBe('invalid_args');
 for(const bad of [{limit:21},{cursor:'tampered'},{limit:0}]) {
  const state=await runFederatedBroker('hub_namespaces',bad,actor,{},settings,deps);
  expect(state.ok).toBe(false);
 }
 expect(deps.resolve).not.toHaveBeenCalled();
});
