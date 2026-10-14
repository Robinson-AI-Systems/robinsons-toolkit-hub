import {randomUUID} from 'node:crypto';
import {it,expect,vi} from 'vitest';
import {runFederatedBroker} from '../src/federation.js';
import {mcpFederatedReply} from '../src/http-door.js';
const actor={id:randomUUID(),ownerId:'owner-a',clientId:'devclient',
 profile:'full',mode:'test',areas:['gateway'],allowWrites:false};
const service={name:'stripe',prefix:'stripe',areas:['billing'],
 claimedCounts:{tools:12}};
const grant={grantId:randomUUID(),server:'stripe',prefix:'stripe',
 profile:'read_only',mode:'test',areas:['billing'],
 origin:'https://stripe-mcp-psi.vercel.app',pass:'test-injected-not-a-real-pass'};
function deps() {
 const d={
 list:vi.fn(async()=>[service]),
 resolve:vi.fn(async()=>grant),
 describe:vi.fn(async()=>({name:'stripe_invoice_list',area:'billing',
  writes:false,money:false,destructive:false,
  annotations:{readOnlyHint:true},inputSchema:{type:'object'}})),
 audit:vi.fn(async()=>77),
 read:vi.fn(async()=>({ok:true,result:{items:[{id:'synthetic'}]},
  logged:{id:'upstream_log_5'}})),
 correlation:()=>randomUUID()
 };
 return d;
}
it('native Hub call forwards an independently narrowed read, with durable before/after audit',async()=>{
 const d=deps();
 const result=await mcpFederatedReply({jsonrpc:'2.0',id:2,
  method:'tools/call',params:{name:'hub_call',arguments:{
   name:'stripe_invoice_list',args:{limit:1}}}},actor,{},{},d);
 expect(result.result.structuredContent).toMatchObject({
  name:'stripe_invoice_list',server:'stripe',upstreamLogId:'upstream_log_5',
  result:{items:[{id:'synthetic'}]}});
 expect(d.describe).toHaveBeenCalledTimes(1);
 expect(d.read).toHaveBeenCalledWith(grant,'stripe_invoice_list',{limit:1});
 expect(d.audit).toHaveBeenCalledTimes(2);
 const first=d.audit.mock.calls[0][1],last=d.audit.mock.calls[1][1];
 expect(first).toMatchObject({actor,grantId:grant.grantId,
  service:'stripe',phase:'attempt',outcome:'allowed'});
 expect(last).toMatchObject({phase:'outcome',outcome:'success',
  upstreamLogId:'upstream_log_5'});
 expect(first.correlationId).toBe(last.correlationId);
 expect(JSON.stringify(result)).not.toContain(grant.pass);
});
it('does not call upstream if metadata permits writes or durable attempt fails',async()=>{
 const d=deps();
 d.describe.mockResolvedValueOnce({name:'stripe_invoice_list',
  area:'billing',writes:true,money:false,destructive:false,
  annotations:{readOnlyHint:true}});
 const forbidden=await runFederatedBroker('hub_call',{name:'stripe_invoice_list'},
  actor,{},{},d);
 expect(forbidden.error.code).toBe('outside_scope');
 expect(d.audit).not.toHaveBeenCalled();
 expect(d.read).not.toHaveBeenCalled();
 const unavailable=deps();
 unavailable.audit.mockRejectedValueOnce(Error('offline db')); 
 const result=await runFederatedBroker('hub_call',
  {name:'stripe_invoice_list'},actor,{},{},unavailable);
 expect(result.error.code).toBe('unavailable');
 expect(unavailable.read).not.toHaveBeenCalled();
});
it('records uncertain read outcome without retries, and never returns a success',async()=>{
 const d=deps();
 d.read.mockRejectedValueOnce(Error('unknown POST result'));
 const result=await runFederatedBroker('hub_call',
  {name:'stripe_invoice_list'},actor,{},{},d);
 expect(result.error.code).toBe('unavailable');
 expect(d.read).toHaveBeenCalledTimes(1);
 expect(d.audit).toHaveBeenCalledTimes(2);
 expect(d.audit.mock.calls[1][1].outcome).toBe('unavailable');
});
it('preserves provider guard and rate-limit refusal codes without leaking details',async()=>{
 for(const code of ['outside_scope','pass_revoked','rate_limited']) {
  const d=deps();d.read.mockResolvedValueOnce({ok:false,
   error:{code,what:'secret technical provider details'}});
  const result=await runFederatedBroker('hub_call',
   {name:'stripe_invoice_list'},actor,{},{},d);
  expect(result.error.code).toBe(code);
  expect(d.audit.mock.calls[1][1].outcome).toBe('refused');
  expect(JSON.stringify(result)).not.toContain('secret technical provider details');
 }
});
it('executes bounded read-only batch sequentially and reports individual denials',async()=>{
 const d=deps();
 const result=await runFederatedBroker('hub_batch',{calls:[
  {name:'stripe_invoice_list'},{name:'stripe_forbidden_write'}]},actor,{},{},d);
 expect(result.ok).toBe(true);
 expect(result.result.results[0].ok).toBe(true);
 expect(result.result.results[1].ok).toBe(false);
 expect(d.read).toHaveBeenCalledTimes(1);
 const tooLarge=await runFederatedBroker('hub_batch',
  {calls:Array(11).fill({name:'stripe_invoice_list'})},actor,{},{},d);
 expect(tooLarge.ok).toBe(false);
});
it('refuses other owners, names and excessive inline results',async()=>{
 const d=deps();
 d.list.mockResolvedValueOnce([]);
 const missing=await runFederatedBroker('hub_call',{name:'stripe_invoice_list'},
  actor,{},{},d);
 expect(missing.error.code).toBe('not_found');
 expect(d.read).not.toHaveBeenCalled();
 const huge=deps();
 huge.read.mockResolvedValueOnce({ok:true,result:{x:'x'.repeat(9000)}});
 const state=await runFederatedBroker('hub_call',{name:'stripe_invoice_list'},
  actor,{},{},huge);
 expect(state.error.code).toBe('unavailable');
 expect(huge.audit).toHaveBeenCalledTimes(2);
});

it('selects longest canonical service prefix for nested registered services',async()=>{
 const d=deps();
 const deeper={name:'foo_bar_service',prefix:'foo_bar',
   areas:['billing'],claimedCounts:{tools:1}};
 const shallower={name:'foo_service',prefix:'foo',
   areas:['billing'],claimedCounts:{tools:1}};
 d.list.mockResolvedValueOnce([shallower,deeper]);
 const selectedGrant={...grant,server:deeper.name,prefix:'foo_bar'};
 d.resolve.mockResolvedValueOnce(selectedGrant).mockResolvedValueOnce(selectedGrant);
 d.describe.mockResolvedValueOnce({name:'foo_bar_item_list',area:'billing',
   writes:false,money:false,destructive:false,
   annotations:{readOnlyHint:true}});
 const result=await runFederatedBroker('hub_call',
   {name:'foo_bar_item_list'},actor,{},{},d);
 expect(result.ok).toBe(true);
 expect(d.resolve).toHaveBeenCalledWith(expect.anything(),
   {actor,serverName:'foo_bar_service'},expect.anything());
 expect(d.read).toHaveBeenCalledWith(selectedGrant,'foo_bar_item_list',{});
 const d2=deps();
 d2.list.mockResolvedValueOnce([shallower,deeper]);
 d2.resolve.mockResolvedValue(selectedGrant);
 d2.describe.mockResolvedValueOnce({name:'foo_bar_item_list',
   area:'billing',inputSchema:{type:'object'},writes:false});
 const described=await runFederatedBroker('hub_describe_tool',
   {name:'foo_bar_item_list'},actor,{},{},d2);
 expect(described.result.server).toBe('foo_bar_service');
});


it('routes describe and audited RTC calls to the last authorized service in a 100-service roster',async()=>{
 const d=deps(),members=Array.from({length:99},(_,i)=>({
  name:'svc'+String(i).padStart(3,'0'),
  prefix:'svc'+String(i).padStart(3,'0'),areas:['billing'],
  claimedCounts:{tools:1}}));
 members.push({name:'workspace',prefix:'workspace_',areas:['billing'],
  claimedCounts:{tools:1}});
 d.list.mockResolvedValue(members);
 const selected={...grant,server:'workspace',prefix:'workspace_'};
 d.resolve.mockResolvedValue(selected);
 d.describe.mockResolvedValue({name:'workspace_drive_list',area:'billing',
  writes:false,money:false,destructive:false,
  annotations:{readOnlyHint:true},inputSchema:{type:'object'}});
 const described=await runFederatedBroker('hub_describe_tool',
  {name:'workspace_drive_list'},actor,{},{},d);
 expect(described.ok).toBe(true);
 expect(described.result.server).toBe('workspace');
 const executed=await runFederatedBroker('hub_call',
  {name:'workspace_drive_list',args:{}},actor,{},{},d);
 expect(executed.ok).toBe(true);
 expect(executed.result.server).toBe('workspace');
 expect(d.list).toHaveBeenCalledTimes(2);
 expect(d.list).toHaveBeenNthCalledWith(1,expect.anything(),actor,{limit:100});
 expect(d.list).toHaveBeenNthCalledWith(2,expect.anything(),actor,{limit:100});
 expect(d.resolve).toHaveBeenCalledWith(expect.anything(),
  {actor,serverName:'workspace'},expect.anything());
 expect(d.read).toHaveBeenCalledTimes(1);
 expect(d.audit).toHaveBeenCalledTimes(2);
 const denied=deps();denied.list.mockResolvedValue(members);
 const refused=await runFederatedBroker('hub_call',
  {name:'workspace__drive_list'},actor,{},{},denied);
 expect(refused.error.code).toBe('not_found');
 expect(denied.resolve).not.toHaveBeenCalled();
 expect(denied.read).not.toHaveBeenCalled();
});

it('does not return a read schema after a grant is revoked during metadata GET',async()=>{
 const d=deps();
 d.resolve.mockResolvedValueOnce(grant).mockResolvedValueOnce(null);
 const result=await runFederatedBroker('hub_describe_tool',
  {name:'stripe_invoice_list'},actor,{},{},d);
 expect(result.error.code).toBe('outside_scope');
 expect(d.read).not.toHaveBeenCalled();
 expect(d.audit).not.toHaveBeenCalled();
});
