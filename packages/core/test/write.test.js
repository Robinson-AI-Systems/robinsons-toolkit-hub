import {describe,it,expect,vi} from 'vitest';
import {defineWrite} from '../src/write.js';

const parse=value=>JSON.parse(value.content[0].text);
function fixture(override={}) {
  let after={value:'changed'};
  const log=[],calls=[];
  const hooks={
    name:'fixture_change',
    read:vi.fn(async()=>({value:'original'})),
    summarize:vi.fn(async()=>'Update an isolated test fixture'),
    apply:vi.fn(async(args,ctx,options)=>{calls.push(options);}),
    readAfter:vi.fn(async()=>after),
    verify:vi.fn(async(_before, observed)=>observed.value==='changed'),
    idempotency:vi.fn(()=> 'rmcp_fixed_request_key'),
    inverse:vi.fn(async()=>({tool:'fixture_restore',args:{id:'t'}})),
    accountOf:conn=>conn?.tenant,
    idempotencyPrefix:'rmcp_',
    ...override
  };
  const op=defineWrite(hooks);
  const ctx={connection:{tenant:'tenant-a',profile:'full',mode:'test'},
    connectionId:'connection-a',db:{recordChange:vi.fn(async row=>{log.push(row);return log.length;})}};
  return {op,ctx,hooks,log,calls,failReadBack:()=>{after={value:'old'};}};
}
describe('source-equivalent private guarded write lifecycle',()=>{
  it('dryRun always previews without mutating and audits TEST only',async()=>{
    const f=fixture();
    const v=parse(await f.op.handler({dryRun:true,confirm:true},f.ctx));
    expect(v).toMatchObject({done:false,mode:'test',preview:'Update an isolated test fixture'});
    expect(f.hooks.apply).not.toHaveBeenCalled();
    expect(f.log).toMatchObject([{account:'tenant-a',dryRun:true,tool:'fixture_change'}]);
  });
  it('requires a true confirmation flag and refuses fabricated input',async()=>{
    const f=fixture();
    expect(parse(await f.op.handler({},f.ctx)).needsConfirmation).toBe(true);
    expect(parse(await f.op.handler({confirm:'yes'},f.ctx)).error).toMatch(/confirmation flags/);
    expect(f.hooks.apply).not.toHaveBeenCalled();
    expect(f.log).toHaveLength(0);
  });
  it('persists intent before apply, reads back independently, then commits audit and inverse',async()=>{
    const f=fixture();
    const v=parse(await f.op.handler({confirm:true,requestKey:'x'},f.ctx));
    expect(v).toMatchObject({done:true,confirmed:true,idempotencyKey:'rmcp_fixed_request_key'});
    expect(f.calls).toEqual([{idempotencyKey:'rmcp_fixed_request_key',before:{value:'original'}}]);
    expect(f.log).toHaveLength(2);
    expect(f.log[0]).toMatchObject({account:'tenant-a',dryRun:true,idempotencyKey:'rmcp_fixed_request_key'});
    expect(f.log[0].summary).toMatch(/^PENDING:/);
    expect(f.log[1]).toMatchObject({account:'tenant-a',dryRun:false,
      inverse:{tool:'fixture_restore'},idempotencyKey:'rmcp_fixed_request_key'});
    expect(f.hooks.readAfter).toHaveBeenCalledTimes(1);
  });
  it('fails closed for live without an explicitly affirmative server guard',async()=>{
    const f=fixture();
    const v=parse(await f.op.handler({confirm:true},{...f.ctx,
      connection:{...f.ctx.connection,mode:'live'}}));
    expect(v.done).toBe(false);
    expect(v.error).toMatch(/LIVE changes are not enabled/);
    expect(f.hooks.apply).not.toHaveBeenCalled();
  });
  it('rejects missing account, read_only scope, missing audit and bad key prefix before writes',async()=>{
    const f=fixture();
    for(const connection of [
      {...f.ctx.connection,tenant:null},
      {...f.ctx.connection,profile:'read_only'},
      {...f.ctx.connection,mode:'unknown'}
    ]) {
      expect(parse(await f.op.handler({confirm:true},{...f.ctx,connection})).done).toBe(false);
    }
    expect(parse(await f.op.handler({confirm:true},{...f.ctx,db:{}})).error).toMatch(/Audit/);
    const invalid=fixture({idempotency:()=> 'unknown'});
    expect(parse(await invalid.op.handler({confirm:true},invalid.ctx)).error).toMatch(/stable provider/);
    expect(f.hooks.apply).not.toHaveBeenCalled();
    expect(invalid.hooks.apply).not.toHaveBeenCalled();
  });
  it('refuses unscoped, padded and control-character account identities before reads',async()=>{
    for(const tenant of ['','  ',' tenant-a','tenant-a ','tenant\\nother',
      'a'.repeat(257)]) {
      const f=fixture();
      const result=parse(await f.op.handler({confirm:true},{...f.ctx,
        connection:{...f.ctx.connection,tenant}}));
      expect(result.done).toBe(false);
      expect(result.error).toMatch(/not allowed to change/);
      expect(f.hooks.read).not.toHaveBeenCalled();
      expect(f.hooks.apply).not.toHaveBeenCalled();
      expect(f.log).toHaveLength(0);
    }
  });
  it('refuses active and malformed service target authorization before preview or apply',async()=>{
    let getters=0;
    const active={};Object.defineProperty(active,'allowed',{enumerable:true,
      get(){getters++;return true;}});
    const nested={allowed:true,ownership:{id:'safe'}};
    Object.defineProperty(nested.ownership,'ownerId',{enumerable:true,
      get(){getters++;return 'private';}});
    for(const result of [active,nested,{allowed:true,ownership:new Date()},
      Object.assign(Object.create({allowed:true}),{ownership:{id:'x'}})]) {
      const f=fixture({targetGuard:vi.fn(async()=>result)});
      const response=parse(await f.op.handler({confirm:true},f.ctx));
      expect(response.done).toBe(false);
      expect(response.error).toMatch(/unsafe target/);
      expect(f.hooks.summarize).not.toHaveBeenCalled();
      expect(f.hooks.apply).not.toHaveBeenCalled();
      expect(f.log).toHaveLength(0);
    }
    expect(getters).toBe(0);
    const permitted=fixture({targetGuard:vi.fn(async()=>({allowed:true,
      ownership:{id:'safe'}}))});
    expect(parse(await permitted.op.handler({confirm:true},permitted.ctx)).done).toBe(true);
  });
  it('denies unsafe and oversized provider retry identifiers before applying changes',async()=>{
    for(const key of ['rmcp_has space','rmcp_bad\\nkey','rmcp_bad\\tkey',
      'rmcp_'+ 'x'.repeat(260)]) {
      const f=fixture({idempotency:()=>key});
      const result=parse(await f.op.handler({confirm:true},f.ctx));
      expect(result.error).toMatch(/stable provider retry identifier/);
      expect(f.hooks.apply).not.toHaveBeenCalled();
      expect(f.log).toHaveLength(0);
    }
  });
  it('requires an independent money gate when a prepared action moves funds',async()=>{
    const prepared=()=>({previewLine:'Debit demo funds',amountCents:1000,currency:'usd',direction:'out'});
    const none=fixture({prepare:prepared});
    expect(parse(await none.op.handler({confirm:true},none.ctx)).error).toMatch(/money authorization/);
    expect(none.hooks.apply).not.toHaveBeenCalled();
    const deny=fixture({prepare:prepared,beforeApply:vi.fn(async()=>({accepted:false,reason:'owner refused'}))});
    expect(parse(await deny.op.handler({confirm:true},deny.ctx)).error).toBe('owner refused');
    expect(deny.hooks.apply).not.toHaveBeenCalled();
    const allow=fixture({prepare:prepared,beforeApply:vi.fn(async()=>({accepted:true})),
      afterApply:vi.fn(async()=>{})});
    expect(parse(await allow.op.handler({confirm:true},allow.ctx)).confirmed).toBe(true);
    expect(allow.log.at(-1)).toMatchObject({amountCents:1000,currency:'usd',direction:'out'});
  });
  it('does not call provider if intent record fails; uncertain outcomes are not successes',async()=>{
    const f=fixture();
    f.ctx.db.recordChange.mockRejectedValueOnce(new Error('database down'));
    expect(parse(await f.op.handler({confirm:true},f.ctx)).error).toMatch(/record intent/);
    expect(f.hooks.apply).not.toHaveBeenCalled();
    const uncertain=fixture();
    uncertain.failReadBack();
    const v=parse(await uncertain.op.handler({confirm:true},uncertain.ctx));
    expect(v.done).toBe(false);
    expect(v.confirmed).toBe(false);
    expect(v.warning).toMatch(/Read-back/);
    expect(uncertain.log.at(-1).dryRun).toBe(false);
  });
  it('audit finalization failure does not report success for a provider mutation',async()=>{
    const f=fixture();
    f.ctx.db.recordChange.mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('audit failure'));
    const v=parse(await f.op.handler({confirm:true},f.ctx));
    expect(v.done).toBe(false);
    expect(v.warning).toMatch(/audit could not be finalized/);
    expect(f.hooks.apply).toHaveBeenCalledTimes(1);
  });
  it('constructor rejects missing hooks, malformed name, and missing account binding',()=>{
    const f=fixture();
    expect(()=>defineWrite({name:'INVALID'})).toThrow(/Valid tool name/);
    expect(()=>defineWrite({...f.hooks,accountOf:null})).toThrow(/binding/);
    expect(()=>defineWrite({...f.hooks,idempotencyPrefix:''})).toThrow(/binding/);
    expect(()=>defineWrite({...f.hooks,needsConfirm:false})).toThrow(/Confirmation/);
  });
});
