import {randomUUID} from 'node:crypto';
import {it,expect,vi} from 'vitest';
import {createCatalogueCache} from '../src/catalogue-cache.js';
import {runFederatedBroker} from '../src/federation.js';

const actor={id:randomUUID(),ownerId:'isolated-fixture-owner',
 clientId:'test-client',mode:'test',profile:'read_only',
 allowWrites:false,areas:['gateway']};
const target={name:'stripe',prefix:'stripe',areas:['billing'],
 origin:'https://rtc.example.net',verifiedAt:'2026-10-14T00:00:00Z',
 grantId:'verified-grant'};
const grant={grantId:'verified-grant',server:'stripe',prefix:'stripe',
 origin:target.origin,mode:'test',profile:'read_only',
 areas:['billing'],pass:'fixture-only-pass-that-must-not-appear'};
const settings={pepper:'isolated-fixture-cache-pepper-over-32-characters'};
const request={query:'invoice',area:'billing',limit:1};
const read={tools:[{name:'stripe_invoice_list',description:'List harmless invoices',
 area:'billing',writes:false,money:false,destructive:false,
 annotations:{readOnlyHint:true},profiles:['read_only']}],
 next:{kind:'offset',value:'1'},incomplete:true};
const clock={time:1000000,now(){return this.time;}};

it('caches only approved RTC listings briefly and copies values without extending TTL',async()=>{
 const cache=createCatalogueCache(),fetch=vi.fn(async()=>structuredClone(read));
 const at=()=>clock.time;
 const first=await cache.getOrFetch(actor,target,grant,request,settings,fetch,{now:at});
 expect(first).toEqual(read);
 first.tools[0].description='caller should not mutate cache';
 const second=await cache.getOrFetch(actor,target,grant,request,settings,fetch,{now:at});
 expect(second).toEqual(read);
 expect(fetch).toHaveBeenCalledTimes(1);
 expect(cache.stats().entries).toBe(1);
 clock.time+=14999;
 await cache.getOrFetch(actor,target,grant,request,settings,fetch,{now:at});
 expect(fetch).toHaveBeenCalledTimes(1);
 clock.time+=1;
 await cache.getOrFetch(actor,target,grant,request,settings,fetch,{now:at});
 expect(fetch).toHaveBeenCalledTimes(2);
 cache.clear();expect(cache.stats()).toEqual({entries:0,bytes:0});
 clock.time=1000000;
});

it('partitions caches by exact owner, caller, grant, origin, verification and cursor shape',async()=>{
 const cache=createCatalogueCache(),fetch=vi.fn(async()=>read);
 const at=()=>1000;
 const altered=[
  [{...actor,id:randomUUID()},target,grant,request],
  [{...actor,ownerId:'other'},target,grant,request],
  [actor,target,{...grant,grantId:'replacement'},request],
  [actor,target,{...grant,origin:'https://new.example.net'},request],
  [actor,{...target,verifiedAt:'2026-10-14T00:01:00Z'},grant,request],
  [actor,target,grant,{...request,query:'other'}],
  [actor,target,grant,{...request,cursor:{kind:'page',value:'2'}}],
  [actor,target,grant,{...request,cursor:{kind:'offset',value:'2'}}]
 ];
 await cache.getOrFetch(actor,target,grant,request,settings,fetch,{now:at});
 for(const [a,t,g,q] of altered)
  await cache.getOrFetch(a,t,g,q,settings,fetch,{now:at});
 expect(fetch).toHaveBeenCalledTimes(altered.length+1);
 expect(cache.stats().entries).toBe(altered.length+1);
 const json=JSON.stringify(cache.stats());
 expect(json).not.toContain(grant.pass);
});

it('never caches failed, untrusted, write-capable or oversized listings',async()=>{
 const cache=createCatalogueCache(),fetch=vi.fn();
 for(const response of [
  {...read,tools:[{...read.tools[0],writes:true}]},
  {...read,next:{kind:'cursor',value:'../../private'}},
  {...read,tools:[{...read.tools[0],description:'x'.repeat(9000)}]}
 ]){
  fetch.mockResolvedValueOnce(response);
  const result=await cache.getOrFetch(actor,target,grant,request,settings,fetch);
  expect(result).toEqual(response);
  expect(cache.stats().entries).toBe(0);
 }
 fetch.mockRejectedValueOnce(new Error('GET failed'));
 await expect(cache.getOrFetch(actor,target,grant,request,settings,fetch))
  .rejects.toThrow('GET failed');
 expect(cache.stats().entries).toBe(0);
});

it('enforces bounded LRU entries and byte accounting without timers or database writes',async()=>{
 const cache=createCatalogueCache(),fetch=vi.fn(async()=>read);
 for(let i=0;i<80;i++){
  const next={...request,query:'safe-'+i};
  await cache.getOrFetch(actor,target,grant,next,settings,fetch);
  expect(cache.stats().entries).toBeLessThanOrEqual(64);
  expect(cache.stats().bytes).toBeLessThanOrEqual(131072);
 }
 expect(cache.stats().entries).toBe(64);
 await cache.getOrFetch(actor,target,grant,{...request,query:'safe-79'},settings,fetch);
 expect(fetch).toHaveBeenCalledTimes(80);
 await cache.getOrFetch(actor,target,grant,{...request,query:'safe-0'},settings,fetch);
 expect(fetch).toHaveBeenCalledTimes(81);
});

it('revalidates active grants on every cached federation reply and misses after rotation',async()=>{
 const cache=createCatalogueCache(),search=vi.fn(async()=>read);
 let active={...grant};
 const resolve=vi.fn(async()=>active);
 const deps={cache,list:vi.fn(async()=>[target]),resolve,search};
 const options={query:'invoice',server:'stripe',area:'billing',limit:1};
 const first=await runFederatedBroker('hub_search_tools',options,actor,{},settings,deps);
 expect(first.ok).toBe(true);
 const second=await runFederatedBroker('hub_search_tools',options,actor,{},settings,deps);
 expect(second.ok).toBe(true);
 expect(search).toHaveBeenCalledTimes(1);
 expect(resolve).toHaveBeenCalledTimes(4);
 active=null;
 const revoked=await runFederatedBroker('hub_search_tools',options,actor,{},settings,deps);
 expect(revoked.result.failures).toEqual([{server:'stripe',code:'unavailable'}]);
 expect(revoked.result.tools).toEqual([]);
 expect(search).toHaveBeenCalledTimes(1);
 active={...grant,grantId:'new-independent-grant'};
 const rotated=await runFederatedBroker('hub_search_tools',options,actor,{},settings,deps);
 expect(rotated.ok).toBe(true);
 expect(search).toHaveBeenCalledTimes(2);
 expect(JSON.stringify([first,second,revoked,rotated])).not.toContain(grant.pass);
});

it('withholds cached metadata if grant is revoked between cache lookup and post-read check',async()=>{
 const cache=createCatalogueCache(),search=vi.fn(async()=>read);
 const resolve=vi.fn().mockResolvedValueOnce(grant)
  .mockResolvedValueOnce(grant)
  .mockResolvedValueOnce(grant)
  .mockResolvedValueOnce(null);
 const deps={cache,list:vi.fn(async()=>[target]),resolve,search};
 const options={query:'invoice',server:'stripe',area:'billing',limit:1};
 const initial=await runFederatedBroker('hub_search_tools',options,actor,{},settings,deps);
 expect(initial.result.tools).toHaveLength(1);
 const revoked=await runFederatedBroker('hub_search_tools',options,actor,{},settings,deps);
 expect(revoked.result.tools).toEqual([]);
 expect(revoked.result.failures).toEqual([{server:'stripe',code:'unavailable'}]);
 expect(search).toHaveBeenCalledTimes(1);
 expect(resolve).toHaveBeenCalledTimes(4);
});
