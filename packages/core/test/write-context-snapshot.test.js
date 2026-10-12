import {describe,it,expect,vi} from 'vitest';
import {defineWrite} from '../src/write.js';

const decode=result=>JSON.parse(result.content[0].text);
function fixture() {
  const records=[];
  const hooks={
    name:'test_change',accountOf:connection=>connection.tenant,
    idempotencyPrefix:'test_',idempotency:vi.fn(connection=>
      'test_'+connection.tenant+'_'+connection.mode),
    read:vi.fn(async()=>({value:10})),summarize:vi.fn(async()=> 'Move isolated test balance'),
    prepare:vi.fn(async()=>({previewLine:'Refund fixture cents',amountCents:25,
      currency:'usd',direction:'out'})),
    beforeApply:vi.fn(async()=>({accepted:true})),
    afterApply:vi.fn(async()=>{}),
    apply:vi.fn(async()=>{}),readAfter:vi.fn(async()=>({value:9})),
    verify:vi.fn(async()=>true)
  };
  const ctx={connection:{tenant:'tenant-a',mode:'test',profile:'full',
    scope:{owner:'owner-a'}},connectionId:'conn-a',
    db:{recordChange:vi.fn(async row=>{records.push(row);})}};
  return {op:defineWrite(hooks),ctx,hooks,records};
}
describe('guarded writes bind immutable service connection across money decision and audit',()=>{
  it('keeps original account/mode/owner and audit identity despite async caller mutation',async()=>{
    const f=fixture();
    f.hooks.read.mockImplementationOnce(async(_args,bound)=>{
      expect(bound).not.toBe(f.ctx);
      expect(bound.connection).not.toBe(f.ctx.connection);
      expect(Object.isFrozen(bound)).toBe(true);
      expect(Object.isFrozen(bound.connection.scope)).toBe(true);
      f.ctx.connection.tenant='tenant-other';
      f.ctx.connection.mode='live';
      f.ctx.connection.scope.owner='owner-other';
      f.ctx.connectionId='conn-other';
      return {value:10};
    });
    f.hooks.beforeApply.mockImplementationOnce(async({ctx,prepared})=>{
      expect(ctx.connection).toMatchObject({tenant:'tenant-a',mode:'test',
        scope:{owner:'owner-a'}});
      expect(ctx.connectionId).toBe('conn-a');
      expect(prepared.amountCents).toBe(25);
      return {accepted:true};
    });
    const outcome=decode(await f.op.handler({confirm:true},f.ctx));
    expect(outcome).toMatchObject({done:true,mode:'test',
      idempotencyKey:'test_tenant-a_test'});
    expect(f.hooks.apply).toHaveBeenCalledTimes(1);
    expect(f.records).toHaveLength(2);
    for(const log of f.records) {
      expect(log).toMatchObject({account:'tenant-a',mode:'test',connection:'conn-a'});
      expect(JSON.stringify(log)).not.toContain('tenant-other');
    }
  });
  it('rejects active connection/accessor context without invoking getters or any hooks',async()=>{
    let getters=0;
    const active={tenant:'tenant-a',mode:'test',profile:'full'};
    Object.defineProperty(active,'tenant',{enumerable:true,get(){getters++;return 'tenant-a';}});
    const badCtx={connection:{tenant:'tenant-a',mode:'test',profile:'full'},db:{}};
    Object.defineProperty(badCtx,'connection',{enumerable:true,get(){getters++;return active;}});
    const activeId={connection:{tenant:'tenant-a',mode:'test',profile:'full'},db:{}};
    Object.defineProperty(activeId,'connectionId',{enumerable:true,get(){getters++;return 'conn-a';}});
    const inputs=[
      {...fixture().ctx,connection:active},
      badCtx,activeId,
      {...fixture().ctx,connection:{tenant:'tenant-a',mode:'test',profile:'full',
        owner:{get token(){getters++;return 'secret';}}}},
      {...fixture().ctx,connectionId:'unsafe'+String.fromCharCode(10)+'connection'},
      {...fixture().ctx,connection:new Date()}
    ];
    for(const ctx of inputs) {
      const f=fixture();
      const answer=decode(await f.op.handler({confirm:true},ctx));
      expect(answer.done).toBe(false);
      expect(answer.error).toMatch(/not allowed/);
      expect(f.hooks.read).not.toHaveBeenCalled();
      expect(f.hooks.beforeApply).not.toHaveBeenCalled();
      expect(f.hooks.apply).not.toHaveBeenCalled();
    }
    expect(getters).toBe(0);
  });
  it('continues requiring independent owner approval even with immutable context',async()=>{
    const f=fixture();
    f.hooks.beforeApply.mockResolvedValueOnce({accepted:false,reason:'human denied'});
    const result=decode(await f.op.handler({confirm:true},f.ctx));
    expect(result).toMatchObject({done:false,error:'human denied'});
    expect(f.hooks.apply).not.toHaveBeenCalled();
    expect(f.records).toHaveLength(0);
  });
});
