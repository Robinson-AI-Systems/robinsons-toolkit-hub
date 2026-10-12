// Portable guarded-write failure contracts; never calls a payment provider.
import {describe,it,expect,vi} from 'vitest';
import {defineWrite} from '../src/write.js';

const parse=result=>JSON.parse(result.content[0].text);
function fixture({spec={previewLine:'Move 5 fixture cents',amountCents:5,
  currency:'usd',direction:'out'},classifyError=()=> 'uncertain',
  applyError=null,approval=true,readback=true}={}){
  const effects=[],logs=[],decisions=[];
  const hooks={
    name:'fixture_money',accountOf:conn=>conn.account,
    idempotencyPrefix:'demo_',idempotency:()=> 'demo_once',
    read:vi.fn(async()=>({balance:100})),
    summarize:vi.fn(async()=> 'Change isolated fixture balance'),
    prepare:vi.fn(async()=>spec),
    beforeApply:vi.fn(async context=>{
      decisions.push(context);
      return {accepted:approval,reason:'Independent owner denied'};
    }),
    apply:vi.fn(async(_args,_ctx,options)=>{
      effects.push(options);if(applyError)throw applyError;
    }),
    readAfter:vi.fn(async()=>({balance:readback?95:100})),
    verify:vi.fn(async(before,after)=>before.balance-after.balance===5),
    afterApply:vi.fn(async()=>{}),
    classifyError,
    inverse:vi.fn(async()=>({tool:'fixture_restore',args:{id:'one'}}))
  };
  const op=defineWrite(hooks);
  const ctx={connection:{account:'acct_demo',mode:'test',profile:'full'},
    connectionId:'fixture-conn',db:{recordChange:vi.fn(async row=>{
      logs.push(row);return logs.length;
    })}};
  return {hooks,ctx,logs,effects,decisions,op,
    call:(args={confirm:true})=>op.handler(args,ctx)};
}
describe('adapted write source failure and monetary preview parity',()=>{
  it('refuses malformed provider-derived values before owner decision, audit or provider',async()=>{
    const bad=[
      {amountCents:0,currency:'usd',direction:'out'},
      {amountCents:-5,currency:'usd',direction:'out'},
      {amountCents:1.5,currency:'usd',direction:'out'},
      {amountCents:Number.MAX_SAFE_INTEGER+1,currency:'usd',direction:'out'},
      {amountCents:null,currency:'usd',direction:'out'},
      {amountCents:5,currency:'USD',direction:'out'},
      {amountCents:5,currency:'usd',direction:'sideways'},
      {amountCents:5,currency:'usd'},
      {currency:'usd',direction:'out'},
      {amountCents:5,direction:'out'},
      {amountCents:5,currency:'usd',direction:null}
    ];
    for(const value of bad){
      const f=fixture({spec:{previewLine:'Fixture change',...value}});
      const result=parse(await f.call());
      expect(result.done).toBe(false);
      expect(result.error).toMatch(/Invalid provider-derived money preview/);
      expect(f.hooks.beforeApply).not.toHaveBeenCalled();
      expect(f.hooks.apply).not.toHaveBeenCalled();
      expect(f.logs).toHaveLength(0);
    }
  });
  it('rejects a partial financial specification even if dry run is requested',async()=>{
    const f=fixture({spec:{previewLine:'Partial',currency:'usd'}});
    const result=parse(await f.call({dryRun:true,confirm:true}));
    expect(result.error).toMatch(/Invalid provider-derived money preview/);
    expect(f.hooks.beforeApply).not.toHaveBeenCalled();
    expect(f.logs).toHaveLength(0);
  });
  it('rejects inherited or accessor-based confirmation before preview, money approval or provider calls',async()=>{
    const inherited=Object.create({confirm:true});
    inherited.requestKey='fixture-intent';
    const a=fixture(),denied=parse(await a.call(inherited));
    expect(denied.error).toMatch(/Invalid write arguments/);
    expect(a.hooks.read).not.toHaveBeenCalled();
    expect(a.hooks.beforeApply).not.toHaveBeenCalled();
    expect(a.hooks.apply).not.toHaveBeenCalled();
    expect(a.logs).toHaveLength(0);
    const getter=vi.fn(()=>true),b=fixture(),accessor={};
    Object.defineProperty(accessor,'confirm',{enumerable:true,get:getter});
    const response=parse(await b.call(accessor));
    expect(response.error).toMatch(/Invalid write arguments/);
    expect(getter).not.toHaveBeenCalled();
    expect(b.hooks.apply).not.toHaveBeenCalled();
    const c=fixture(),dryGetter=vi.fn(()=>true),dry={confirm:true};
    Object.defineProperty(dry,'dryRun',{enumerable:true,get:dryGetter});
    expect(parse(await c.call(dry)).error).toMatch(/Invalid write arguments/);
    expect(dryGetter).not.toHaveBeenCalled();
    expect(c.hooks.beforeApply).not.toHaveBeenCalled();
  });
  it('refuses active nested arguments, money previews and owner decisions without provider effects',async()=>{
    let calls=0;
    const arg=fixture(),nested={confirm:true,details:{}};
    Object.defineProperty(nested.details,'amount',{enumerable:true,get(){calls++;return 5;}});
    expect(parse(await arg.call(nested)).error).toMatch(/Invalid write arguments/);
    expect(arg.hooks.read).not.toHaveBeenCalled();
    expect(arg.hooks.beforeApply).not.toHaveBeenCalled();
    const suspicious={previewLine:'Move synthetic funds',currency:'usd',direction:'out'};
    Object.defineProperty(suspicious,'amountCents',{enumerable:true,get(){calls++;return 5;}});
    const poisoned=fixture({spec:suspicious});
    expect(parse(await poisoned.call()).error).toMatch(/Invalid provider-derived money preview/);
    expect(poisoned.hooks.beforeApply).not.toHaveBeenCalled();
    const approval=fixture();
    approval.hooks.beforeApply.mockImplementationOnce(async()=>{
      const decision={};Object.defineProperty(decision,'accepted',{enumerable:true,
        get(){calls++;return true;}});return decision;
    });
    expect(parse(await approval.call()).error).toMatch(/Safety check denied/);
    expect(approval.hooks.apply).not.toHaveBeenCalled();
    expect(approval.logs).toHaveLength(0);
    expect(calls).toBe(0);
  });
  it('requires explicitly owned Boolean confirmation and retains ordinary preview flow',async()=>{
    const noConfirm=fixture();
    const args=Object.create(null);args.requestKey='isolated';
    const pending=parse(await noConfirm.call(args));
    expect(pending.needsConfirmation).toBe(true);
    expect(noConfirm.hooks.apply).not.toHaveBeenCalled();
    args.confirm=true;
    const approved=parse(await noConfirm.call(args));
    expect(approved).toMatchObject({done:true,confirmed:true});
    expect(noConfirm.hooks.beforeApply).toHaveBeenCalledTimes(1);
    expect(noConfirm.hooks.apply).toHaveBeenCalledTimes(1);
  });
  it('requires separate server money approval even when confirm is true',async()=>{
    const f=fixture({approval:false});
    const result=parse(await f.call());
    expect(result.error).toBe('Independent owner denied');
    expect(result.done).toBe(false);
    expect(f.decisions).toHaveLength(1);
    expect(f.effects).toHaveLength(0);
    expect(f.logs).toHaveLength(0);
  });
  it('accepts fully validated money specs with distinct audited intent and outcome',async()=>{
    const f=fixture();
    const result=parse(await f.call());
    expect(result).toMatchObject({done:true,confirmed:true,idempotencyKey:'demo_once'});
    expect(f.decisions).toHaveLength(1);
    expect(f.decisions[0].prepared).toMatchObject({
      amountCents:5,currency:'usd',direction:'out'});
    expect(f.effects).toHaveLength(1);
    expect(f.logs).toHaveLength(2);
    expect(f.logs[0]).toMatchObject({dryRun:true,tool:'fixture_money'});
    expect(f.logs[0].summary).toMatch(/^PENDING:/);
    expect(f.logs[1]).toMatchObject({dryRun:false,amountCents:5,
      currency:'usd',direction:'out',inverse:{tool:'fixture_restore'}});
  });
  it('classifies a crashing error classifier as uncertain and finalizes durable audit',async()=>{
    const f=fixture({applyError:new Error('unknown provider outcome'),
      classifyError:()=>{throw new Error('faulty classifier');}});
    const result=parse(await f.call());
    expect(result).toMatchObject({done:false,confirmed:false,idempotencyKey:'demo_once'});
    expect(result.warning).toMatch(/uncertain/);
    expect(f.hooks.afterApply).toHaveBeenCalledWith(
      expect.objectContaining({status:'uncertain',key:'demo_once'}));
    expect(f.logs).toHaveLength(2);
    expect(f.logs[0].summary).toMatch(/^PENDING:/);
    expect(f.logs[1]).toMatchObject({dryRun:false,amountCents:5,
      currency:'usd',direction:'out',inverse:null});
    expect(f.hooks.inverse).not.toHaveBeenCalled();
  });
  it('never reports successful money transfer when readback fails',async()=>{
    const f=fixture({readback:false});
    const result=parse(await f.call());
    expect(result.done).toBe(false);
    expect(result.warning).toMatch(/Read-back/);
    expect(f.hooks.afterApply).toHaveBeenCalledWith(
      expect.objectContaining({status:'uncertain'}));
    expect(f.logs).toHaveLength(2);
    expect(f.hooks.inverse).not.toHaveBeenCalled();
  });
  it('retains nonfinancial source preview behavior without requiring money adapter',async()=>{
    const f=fixture({spec:{previewLine:'Update nonfinancial record'}});
    const v=parse(await f.call({dryRun:true}));
    expect(v).toMatchObject({done:false,mode:'test',needsConfirmation:true});
    expect(f.hooks.beforeApply).not.toHaveBeenCalled();
    expect(f.logs).toHaveLength(1);
    expect(f.effects).toHaveLength(0);
  });
  it('does not free a money reservation when a provider SDK rejection is ambiguous',async()=>{
    const f=fixture({applyError:new Error('connection timeout'),
      classifyError:()=> 'uncertain'});
    const result=parse(await f.call());
    expect(result.done).toBe(false);
    expect(result.warning).toMatch(/uncertain/);
    expect(f.hooks.afterApply).toHaveBeenCalledWith(
      expect.objectContaining({status:'uncertain'}));
  });
  it('keeps the approved request immutable even if asynchronous service hooks edit caller-owned args',async()=>{
    const f=fixture();
    const submitted={confirm:true,dryRun:false,payment:{amountCents:5,invoice:'owned'}};
    f.hooks.read.mockImplementationOnce(async ()=>{
      submitted.payment.amountCents=50000;
      submitted.payment.invoice='other-owner';
      submitted.confirm=false;
      return {balance:100};
    });
    f.hooks.beforeApply.mockImplementationOnce(async ({args,prepared})=>{
      expect(args).toEqual({confirm:true,dryRun:false,payment:{amountCents:5,invoice:'owned'}});
      expect(Object.isFrozen(args)).toBe(true);
      expect(Object.isFrozen(args.payment)).toBe(true);
      expect(prepared.amountCents).toBe(5);
      return {accepted:true};
    });
    expect(parse(await f.call(submitted))).toMatchObject({done:true,confirmed:true});
    expect(f.hooks.apply.mock.calls[0][0]).toEqual({
      confirm:true,dryRun:false,payment:{amountCents:5,invoice:'owned'}
    });
    expect(f.logs.at(-1)).toMatchObject({amountCents:5,direction:'out'});
  });
  it('keeps preview data stable if a read hook toggles dryRun and request key',async()=>{
    const f=fixture();
    const args={confirm:true,dryRun:true,requestKey:'initial'};
    f.hooks.read.mockImplementationOnce(async ()=>{
      args.dryRun=false; args.requestKey='replaced';
      return {balance:100};
    });
    const result=parse(await f.call(args));
    expect(result).toMatchObject({done:false,needsConfirmation:false});
    expect(f.hooks.summarize.mock.calls[0][1]).toEqual({
      confirm:true,dryRun:true,requestKey:'initial'
    });
    expect(f.hooks.apply).not.toHaveBeenCalled();
    expect(f.logs).toMatchObject([{dryRun:true}]);
  });
});
