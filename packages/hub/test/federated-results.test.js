import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {runFederatedBroker} from '../src/federation.js';
import {mcpFederatedReply} from '../src/http-door.js';

const actor={id:randomUUID(),ownerId:'owner-ci',clientId:'developer',
 profile:'full',mode:'test',areas:['gateway'],allowWrites:false};
const grant={grantId:randomUUID(),origin:'https://fixture.example.com',
 server:'stripe',prefix:'stripe',areas:['billing'],mode:'test',profile:'read_only'};
function fixture(){
 return {
  list:vi.fn(async()=>[{name:'stripe',prefix:'stripe',areas:['billing']}]),
  resolve:vi.fn(async()=>grant),
  describe:vi.fn(async()=>({name:'stripe_invoice_list',area:'billing',
    writes:false,money:false,destructive:false,annotations:{readOnlyHint:true}})),
  read:vi.fn(async()=>({ok:true,result:{items:'🧾'.repeat(2400)}})),
  audit:vi.fn(async()=>1),
  correlation:randomUUID,
  storeResult:vi.fn(async()=>({handle:'rtc_'+'b'.repeat(43),
    bytes:12000,pages:3,readTool:'hub_result_read'})),
  readResult:vi.fn(async()=>({encoding:'base64url',page:0,pages:3,
    bytes:12000,data:'ZXhhbXBsZQ',next:1}))
 };
}
it('replaces oversize inline payload with compact encrypted handle and rechecks grant',async()=>{
 const d=fixture();
 const out=await runFederatedBroker('hub_call',
  {name:'stripe_invoice_list',args:{limit:20}},actor,{},{},d);
 expect(out.ok).toBe(true);
 expect(out.result).toMatchObject({stored:true,handle:'rtc_'+'b'.repeat(43),
  pages:3,readTool:'hub_result_read'});
 expect(JSON.stringify(out)).not.toContain('🧾');
 expect(d.resolve).toHaveBeenCalledTimes(3);
 expect(d.storeResult).toHaveBeenCalledWith(expect.anything(),actor,grant.grantId,
  'stripe',expect.objectContaining({name:'stripe_invoice_list'}),expect.anything());
 const req={jsonrpc:'2.0',id:'page-one',method:'tools/call',
   params:{name:'hub_call',arguments:{
    name:'hub_result_read',args:{handle:'rtc_'+'b'.repeat(43),page:0}}}};
 const page=await mcpFederatedReply(req,actor,{},{},d);
 expect(page.result.structuredContent).toMatchObject({encoding:'base64url',next:1});
 expect(d.readResult).toHaveBeenCalledWith(expect.anything(),actor,
  'rtc_'+'b'.repeat(43),0,expect.anything());
});
it('refuses revoked result handle and does not send a second RTC provider POST',async()=>{
 const d=fixture();d.readResult.mockResolvedValueOnce(null);
 const out=await runFederatedBroker('hub_call',{name:'hub_result_read',
  args:{handle:'rtc_'+'b'.repeat(43)}},actor,{},{},d);
 expect(out.ok).toBe(false);
 expect(out.error.code).toBe('not_found');
 expect(d.read).not.toHaveBeenCalled();
 expect(d.audit).not.toHaveBeenCalled();
 for(const args of [{handle:'nope'},{handle:'rtc_'+'b'.repeat(43),page:16}]) {
  expect((await runFederatedBroker('hub_result_read',args,actor,{},{},d)).ok).toBe(false);
 }
});
it('refuses replaced grant before encrypted result storage and oversize beyond storage limit',async()=>{
 const d=fixture();
 d.resolve.mockResolvedValueOnce(grant).mockResolvedValueOnce(grant)
  .mockResolvedValueOnce({...grant,grantId:randomUUID()});
 const denied=await runFederatedBroker('hub_call',
  {name:'stripe_invoice_list'},actor,{},{},d);
 expect(denied.error.code).toBe('outside_scope');
 expect(d.storeResult).not.toHaveBeenCalled();
 const big=fixture();
 big.read.mockResolvedValueOnce({ok:true,result:{x:'x'.repeat(66000)}});
 const fail=await runFederatedBroker('hub_call',
  {name:'stripe_invoice_list'},actor,{},{},big);
 expect(fail.ok).toBe(false);
 expect(big.storeResult).not.toHaveBeenCalled();
});
