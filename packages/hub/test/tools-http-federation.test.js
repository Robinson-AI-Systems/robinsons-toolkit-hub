import { randomUUID } from 'node:crypto';
import { it, expect, vi } from 'vitest';
import { handleHubTools } from '../src/tools-http.js';
import { runFederatedBroker } from '../src/federation.js';

const actor = { id: randomUUID(), ownerId: 'owned-test', clientId: 'fixture-client',
 profile: 'full', mode: 'test', areas: ['gateway'], allowWrites: false };
const target = { name: 'stripe', prefix: 'stripe', areas: ['billing'],
 claimedCounts: { tools: 12 } };
const grant = { grantId: randomUUID(), server: 'stripe', prefix: 'stripe',
 profile: 'read_only', mode: 'test', areas: ['billing'],
 origin: 'https://synthetic.example.com', pass: 'synthetic-never-log' };
function response() {
 return { headers: {}, code: 0, body: null,
  setHeader(k,v) { this.headers[k]=v; return this; },
  status(n) { this.code=n; return this; },
  json(v) { this.body=v; return this; } };
}
function fixture() {
 const upstream = {
  list: vi.fn(async () => [target]),
  resolve: vi.fn(async () => grant),
  search: vi.fn(async () => ({ tools: [{ name: 'stripe_invoice_list',
   area: 'billing', writes: false, money: false, destructive: false }],
   incomplete: false })),
  describe: vi.fn(async (_grant, name) => ({
   name, area: 'billing', writes: name.endsWith('_write'),
   money: false, destructive: false,
   annotations: { readOnlyHint: !name.endsWith('_write') },
   inputSchema: { type: 'object' } })),
  read: vi.fn(async () => ({ ok: true, result: { invoices: ['TEST-1'] },
   logged: { id: 'rtc_read_log_1' } })),
  audit: vi.fn(async () => 1),
  correlation: randomUUID
 };
 const authorize = vi.fn(async () => ({ actor }));
 const withDb = async fn => fn({}, {pepper:'synthetic-https-search-cursor-key-over-32-bytes'});
 const federate = (name,args,current,db,settings) =>
  runFederatedBroker(name,args,current,db,settings,upstream);
 async function send(route, method, query = {}, body, auth = authorize) {
  const res=response();
  await handleHubTools({method,query,body,headers:{authorization:'fixture'}},
   res,{withDb,authorize:auth,federate},route);
  return res;
 }
 return {send,upstream,authorize};
}
it('discovers and describes only caller-scoped RTC reads over the real HTTP handler',async()=>{
 const {send,upstream}=fixture();
 const list=await send('list','GET',{q:'invoice',server:'stripe',area:'billing',limit:'5'});
 expect(list.code).toBe(200);
 expect(list.body.result.tools.map(x=>x.name)).toEqual(['stripe_invoice_list']);
 expect(list.body.result.scanned).toBe(1);
 const describe=await send('item','GET',{name:'stripe_invoice_list'});
 expect(describe.code).toBe(200);
 expect(describe.body.result).toMatchObject({name:'stripe_invoice_list',
  server:'stripe',writes:false});
 expect(upstream.resolve).toHaveBeenCalledTimes(4);
 expect(upstream.read).not.toHaveBeenCalled();
 expect(upstream.audit).not.toHaveBeenCalled();
 expect(JSON.stringify([list.body,describe.body])).not.toContain(grant.pass);
});
it('routes HTTP POST through exact grant, readOnlyHint and durable attempt/outcome audit',async()=>{
 const {send,upstream}=fixture();
 const reply=await send('item','POST',{name:'stripe_invoice_list'},{limit:1});
 expect(reply.code).toBe(200);
 expect(reply.body.result).toMatchObject({
  name:'stripe_invoice_list',server:'stripe',upstreamLogId:'rtc_read_log_1',
  result:{invoices:['TEST-1']}});
 expect(upstream.resolve).toHaveBeenCalledTimes(3);
 expect(upstream.read).toHaveBeenCalledWith(grant,'stripe_invoice_list',{limit:1});
 expect(upstream.audit).toHaveBeenCalledTimes(2);
 const attempt=upstream.audit.mock.calls[0][1],outcome=upstream.audit.mock.calls[1][1];
 expect(attempt).toMatchObject({actor,grantId:grant.grantId,phase:'attempt'});
 expect(outcome).toMatchObject({phase:'outcome',outcome:'success',
  upstreamLogId:'rtc_read_log_1',correlationId:attempt.correlationId});
 expect(JSON.stringify(reply.body)).not.toContain(grant.pass);
});
it('executes mixed Hub/RTC HTTPS batches sequentially with isolated write refusal',async()=>{
 const {send,upstream}=fixture();
 const result=await send('batch','POST',{}, {calls:[
  {name:'hub_whoami'}, {name:'stripe_invoice_list',args:{limit:1}},
  {name:'stripe_invoice_write',args:{amount:10}}]});
 expect(result.code).toBe(200);
 const entries=result.body.result.results;
 expect(entries).toHaveLength(3);
 expect(entries[0]).toMatchObject({name:'hub_whoami',ok:true});
 expect(entries[1]).toMatchObject({name:'stripe_invoice_list',ok:true});
 expect(entries[2]).toMatchObject({name:'stripe_invoice_write',ok:false,
  error:{code:'outside_scope'}});
 expect(upstream.read).toHaveBeenCalledTimes(1);
 expect(upstream.audit).toHaveBeenCalledTimes(2);
});
it('blocks unauthenticated, LIVE and write-enabled actors before upstream lookup',async()=>{
 const {send,upstream}=fixture();
 for(const state of [null,{actor:{...actor,mode:'live'}},
  {actor:{...actor,allowWrites:true}},{actor:{...actor,areas:[]}}]) {
  const auth=vi.fn(async()=>state);
  const reply=await send('item','POST',{name:'stripe_invoice_list'},{},auth);
  expect(reply.code).toBe(state?403:401);
 }
 expect(upstream.list).not.toHaveBeenCalled();
 expect(upstream.resolve).not.toHaveBeenCalled();
 expect(upstream.read).not.toHaveBeenCalled();
});
it('refuses ungranted and writing tools without dispatch or audit',async()=>{
 const {send,upstream}=fixture();
 upstream.list.mockResolvedValueOnce([]);
 const missing=await send('item','POST',{name:'stripe_invoice_list'},{});
 expect(missing.code).toBe(404);
 upstream.describe.mockResolvedValueOnce({name:'stripe_invoice_write',
  area:'billing',writes:true,money:false,destructive:false,
  annotations:{readOnlyHint:false}});
 const forbidden=await send('item','POST',{name:'stripe_invoice_write'},{});
 expect(forbidden.code).toBe(403);
 expect(upstream.read).not.toHaveBeenCalled();
 expect(upstream.audit).not.toHaveBeenCalled();
});
it('does not retry ambiguous POST or silently return oversized JSON',async()=>{
 const {send,upstream}=fixture();
 upstream.read.mockRejectedValueOnce(Error('unknown outcome'));
 const uncertain=await send('item','POST',{name:'stripe_invoice_list'},{});
 expect(uncertain.code).toBe(503);
 expect(uncertain.body).toEqual({ok:false,error:{code:'unavailable'}});
 expect(upstream.read).toHaveBeenCalledTimes(1);
 upstream.read.mockResolvedValueOnce({ok:true,result:{x:'x'.repeat(18000)}});
 const huge=await send('item','POST',{name:'stripe_invoice_list'},{});
 expect(huge.code).toBe(503);
 expect(huge.body.ok).toBe(false);
 expect(upstream.audit).toHaveBeenCalledTimes(4);
});
it('rejects invalid routes, query selectors and request envelopes before contacting providers',async()=>{
 const {send,upstream}=fixture();
 for(const r of [
  await send('item','GET',{name:'../../escape'}),
  await send('item','POST',{name:'stripe_invoice_list'},{x:'x'.repeat(9000)}),
  await send('list','GET',{q:'invoice',limit:'100'}),
  await send('list','GET',{q:'invoice',area:'../../'}),
  await send('batch','POST',{}, {calls:Array(11).fill({name:'stripe_invoice_list'})})
 ]) expect(r.code).toBe(400);
 expect(upstream.read).not.toHaveBeenCalled();
});

it('continues bounded RTC HTTPS discovery with a caller-bound cursor',async()=>{
 const {send,upstream}=fixture();
 upstream.list.mockResolvedValueOnce([
  {name:'stripe',prefix:'stripe',areas:['billing']},
  {name:'google',prefix:'google',areas:['billing']},
  {name:'github',prefix:'github',areas:['billing']},
  {name:'neon',prefix:'neon',areas:['billing']}
 ]).mockResolvedValueOnce([
  {name:'stripe',prefix:'stripe',areas:['billing']},
  {name:'google',prefix:'google',areas:['billing']},
  {name:'github',prefix:'github',areas:['billing']},
  {name:'neon',prefix:'neon',areas:['billing']}
 ]);
 const first=await send('list','GET',{q:'invoice',area:'billing',limit:'5'});
 expect(first.code).toBe(200);
 expect(first.body.result.scanned).toBe(3);
 expect(typeof first.body.result.next).toBe('string');
 const second=await send('list','GET',{
  q:'invoice',area:'billing',limit:'5',cursor:first.body.result.next});
 expect(second.code).toBe(200);
 expect(second.body.result.scanned).toBe(1);
 expect(second.body.result.next).toBeNull();
 expect(upstream.search).toHaveBeenCalledTimes(4);
});


it('exposes the same guarded federation through every fixed HTTPS broker operation',async()=>{
 const {send,upstream}=fixture();
 const namespace=await send('item','POST',{name:'hub_namespaces'},{});
 expect(namespace.code).toBe(200);
 expect(namespace.body.result.namespaces.map(x=>x.name)).toEqual(['hub','stripe']);
 const discovered=await send('item','POST',{name:'hub_search_tools'},
  {query:'invoice',server:'stripe',area:'billing',limit:5});
 expect(discovered.code).toBe(200);
 expect(discovered.body.result.tools.map(x=>x.name)).toEqual(['stripe_invoice_list']);
 const described=await send('item','POST',{name:'hub_describe_tool'},
  {name:'stripe_invoice_list'});
 expect(described.code).toBe(200);
 expect(described.body.result.server).toBe('stripe');
 const called=await send('item','POST',{name:'hub_call'},
  {name:'stripe_invoice_list',args:{limit:1}});
 expect(called.code).toBe(200);
 expect(called.body.result).toMatchObject({server:'stripe',
  result:{invoices:['TEST-1']}});
 const batch=await send('item','POST',{name:'hub_batch'},
  {calls:[{name:'hub_health'},{name:'stripe_invoice_list'}]});
 expect(batch.code).toBe(200);
 expect(batch.body.result.results[0]).toMatchObject({name:'hub_health',
  ok:true,result:{result:{accessibleUpstreams:1,providerCallsEnabled:true}}});
 expect(batch.body.result.results[1]).toMatchObject({
  name:'stripe_invoice_list',ok:true});
 expect(upstream.read).toHaveBeenCalledTimes(2);
 expect(upstream.audit).toHaveBeenCalledTimes(4);
 expect(JSON.stringify([namespace,discovered,described,called,batch]))
  .not.toContain(grant.pass);
});

it('keeps health identical across direct, indirect and batch HTTPS reads, including zero-grant status',async()=>{
 const {send,upstream}=fixture();
 for(const members of [[target],[]]){
  upstream.list.mockResolvedValue(members);
  const expected=members.length;
  const direct=await send('item','POST',{name:'hub_health'},{});
  const indirect=await send('item','POST',{name:'hub_call'},
   {name:'hub_health'});
  const allOwned=await send('batch','POST',{},
   {calls:[{name:'hub_whoami'},{name:'hub_health'}]});
  expect(direct.code).toBe(200);
  expect(direct.body.result.accessibleUpstreams).toBe(expected);
  expect(indirect.body.result.result.accessibleUpstreams).toBe(expected);
  expect(allOwned.body.result.results[1].result.result.accessibleUpstreams)
   .toBe(expected);
  expect(direct.body.result.providerCallsEnabled).toBe(Boolean(expected));
 }
 const denied=await send('item','POST',{name:'hub_call'},
  {name:'hub_health',args:{unexpected:true}});
 expect(denied.code).toBe(400);
 expect(denied.body.error.code).toBe('invalid_args');
 expect(upstream.read).not.toHaveBeenCalled();
});

it('denies unsafe broker dispatch before provider read, preserving old whoami behavior',async()=>{
 const {send,upstream}=fixture();
 const who=await send('item','POST',{name:'hub_whoami'},{});
 expect(who.code).toBe(200);
 expect(who.body.result.profile).toBe('full');
 const forbidden=await send('item','POST',{name:'hub_call'},
  {name:'stripe_invoice_write',args:{amount:10}});
 expect(forbidden.code).toBe(403);
 const denied=await send('item','POST',{name:'hub_batch'},
  {calls:[{name:'stripe_invoice_write',args:{amount:10}}]});
 expect(denied.code).toBe(200);
 expect(denied.body.result.results[0].error.code).toBe('outside_scope');
 expect(upstream.read).not.toHaveBeenCalled();
 expect(upstream.audit).not.toHaveBeenCalled();
});


it('browses authorized RTC tools without a guessed query while preserving the default small Hub catalog',async()=>{
 const {send,upstream}=fixture();
 const local=await send('list','GET',{});
 expect(local.code).toBe(200);
 expect(local.body.result.tools.some(t=>t.name==='hub_search_tools')).toBe(true);
 expect(upstream.search).not.toHaveBeenCalled();
 const selected=await send('list','GET',{server:'stripe',limit:'5'});
 expect(selected.code).toBe(200);
 expect(selected.body.result.tools.map(t=>t.name)).toEqual(['stripe_invoice_list']);
 expect(selected.body.result.scanned).toBe(1);
 const broad=await send('list','GET',{q:'',limit:'5'});
 expect(broad.code).toBe(200);
 expect(broad.body.result.tools.map(t=>t.name)).toContain('stripe_invoice_list');
 expect(broad.body.result.tools.some(t=>t.name==='hub_health')).toBe(true);
 expect(upstream.search).toHaveBeenCalledTimes(2);
 expect(upstream.search).toHaveBeenLastCalledWith(grant,
  expect.objectContaining({query:'',limit:1}));
 expect(JSON.stringify([selected.body,broad.body])).not.toContain(grant.pass);
});

it('refuses unscoped anonymous catalogue browse and malformed input before RTC calls',async()=>{
 const {send,upstream}=fixture();
 const noOwner=vi.fn(async()=>({actor:{...actor,ownerId:undefined}}));
 const denied=await send('list','GET',{q:'',server:'stripe'},undefined,noOwner);
 expect(denied.code).toBe(403);
 for(const query of [
  {q:'',limit:'21'},{q:'',cursor:'tampered'},
  {q:'',server:'missing/unsafe'},{q:'',area:'../../'}
 ]) {
  const status=await send('list','GET',query);
  expect(status.code).not.toBe(200);
 }
 expect(upstream.search).not.toHaveBeenCalled();
});

it('returns compact explicit partial HTTPS batch with no extra provider attempts',async()=>{
 const {send,upstream}=fixture();
 upstream.read.mockResolvedValue({ok:true,result:{items:'x'.repeat(4800)}});
 const reply=await send('batch','POST',{}, {calls:Array.from({length:5},
  ()=>({name:'stripe_invoice_list'}))});
 expect(reply.code).toBe(200);
 expect(reply.body.result.incomplete).toBe(true);
 expect(reply.body.result.results).toHaveLength(5);
 expect(reply.body.result.results.slice(2).every(r=>r.ok===false)).toBe(true);
 expect(upstream.read).toHaveBeenCalledTimes(3);
 expect(upstream.audit).toHaveBeenCalledTimes(6);
 expect(Buffer.byteLength(JSON.stringify(reply.body),'utf8')).toBeLessThan(13000);
});


it('continues a selected RTC catalogue through the authenticated HTTPS Hub door',async()=>{
 const {send,upstream}=fixture();
 upstream.search.mockImplementation(async(_grant,args)=>({
  tools:[{name:args.cursor?'stripe_invoice_detail':'stripe_invoice_list',
   area:'billing',description:'Safe TEST metadata',writes:false,money:false,
   destructive:false}],next:args.cursor?null:{kind:'cursor',value:'provider_page_two'},
  incomplete:!args.cursor
 }));
 const options={q:'invoice',server:'stripe',area:'billing',limit:'3'};
 const first=await send('list','GET',options);
 expect(first.code).toBe(200);
 expect(first.body.result.tools.map(t=>t.name)).toEqual(['stripe_invoice_list']);
 const cursor=first.body.result.next;
 expect(cursor).toMatch(/^p\./);
 expect(cursor).not.toContain('provider_page_two');
 const second=await send('list','GET',{...options,cursor});
 expect(second.code).toBe(200);
 expect(second.body.result.tools.map(t=>t.name)).toEqual(['stripe_invoice_detail']);
 expect(second.body.result.next).toBeNull();
 expect(upstream.search.mock.calls.map(c=>c[1].cursor))
  .toEqual([undefined,{kind:'cursor',value:'provider_page_two'}]);
 const altered=await send('list','GET',{...options,q:'other',cursor});
 expect(altered.code).toBe(400);
 expect(altered.body.error.code).toBe('invalid_args');
 expect(upstream.search).toHaveBeenCalledTimes(2);
 expect(upstream.read).not.toHaveBeenCalled();
 expect(upstream.audit).not.toHaveBeenCalled();
 expect(JSON.stringify([first.body,second.body,altered.body])).not.toContain(grant.pass);
});
