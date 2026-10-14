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
   name, area: 'billing', writes: false, money: false, destructive: false,
   annotations: { readOnlyHint: true }, inputSchema: { type: 'object' } })),
  read: vi.fn(async () => ({ ok: true, result: { invoices: ['TEST-1'] },
   logged: { id: 'rtc_read_log_1' } })),
  audit: vi.fn(async () => 1),
  correlation: randomUUID
 };
 const authorize = vi.fn(async () => ({ actor }));
 const withDb = async fn => fn({}, {});
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
 expect(upstream.resolve).toHaveBeenCalledTimes(2);
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
 expect(upstream.resolve).toHaveBeenCalledTimes(2);
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
