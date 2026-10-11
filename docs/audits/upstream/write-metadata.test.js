import {describe,expect,it} from 'vitest';
import {validateWriteDeclarations} from '../../src/core/write-contract-check.js';
import {registry} from '../../src/tools/index.js';
import {defineWrite} from '../../src/tools/write.js';

const read=()=>({name:'sample_read',writes:false,profiles:['read_only']});
const write=()=>({name:'sample_write',writes:true,writeContract:'defineWrite-v1',
  inputSchema:{type:'object',properties:{
    dryRun:{type:'boolean'},confirm:{type:'boolean'}
  }},safety:'P'});
describe('B-7 explicit writes and provider-derived money declarations',()=>{
  it('accepts the current registered read tools and properly declared guarded writes',()=>{
    expect(validateWriteDeclarations(registry.tools)).toEqual([]);
    expect(validateWriteDeclarations([read(),write()])).toEqual([]);
  });
  it('fails when writes is absent or a string, even for harmless-sounding names',()=>{
    expect(validateWriteDeclarations([{name:'stripe_payout'}])).toEqual([
      'stripe_payout: missing explicit writes: true|false declaration'
    ]);
    expect(validateWriteDeclarations([{name:'harmless_tool',writes:'false'}])).toHaveLength(1);
  });
  it('fails when a write omits dryRun or confirm, or declares the wrong type',()=>{
    const a=write();delete a.inputSchema.properties.dryRun;
    expect(validateWriteDeclarations([a]).join(' ')).toMatch(/missing boolean dryRun/);
    const b=write();b.inputSchema.properties.confirm={type:'string'};
    expect(validateWriteDeclarations([b]).join(' ')).toMatch(/missing boolean confirm/);
  });
  it('fails money-out tools that lack a provider-derived spec even with confirmation',()=>{
    const a={...write(),name:'dangerous_refund',safety:'$'};
    expect(validateWriteDeclarations([a])).toContain(
      'dangerous_refund: money-out tool missing provider-derived money spec'
    );
    const b={...a,moneySpec:'provider-derived'};
    expect(validateWriteDeclarations([b])).toEqual([]);
    expect(validateWriteDeclarations([{...b,writes:false}]).join(' '))
      .toMatch(/money-out safety marker/);
  });
  it('refuses writes with no trusted lifecycle, and read tools faking a money spec',()=>{
    const a=write();a.writeContract='unchecked';
    expect(validateWriteDeclarations([a]).join(' ')).toMatch(/defineWrite-v1/);
    expect(validateWriteDeclarations([{...read(),moneySpec:'provider-derived'}]).join(' '))
      .toMatch(/read-only tool cannot declare/);
  });
  it('actual Stripe write adapter declares money spec only when installed',()=>{
    const make=money=>defineWrite({name:money?'stripe_sample_refund':'stripe_sample_update',
      read:async()=>({id:'fake',amount:500,currency:'usd'}),
      summarize:async()=> 'Change isolated fake object',
      apply:async()=>{},readAfter:async()=>({ok:true}),verify:async()=>true,
      ...(money?{money:async(_a,_c,b)=>({amountCents:b.amount,currency:b.currency,
        targetId:'ch_FAKE1234',direction:'out',description:'Fake refundable cents'})}:{})
    });
    const monetary=make(true),notMonetary=make(false);
    expect(monetary.tool.moneySpec).toBe('provider-derived');
    expect(monetary.tool.safety).toBe('$');
    expect(notMonetary.tool.moneySpec).toBeNull();
    expect(validateWriteDeclarations([monetary.tool,notMonetary.tool])).toEqual([]);
  });
  it('rejects invalid registry shapes instead of treating them as zero tools',()=>{
    expect(validateWriteDeclarations(null)).toHaveLength(1);
    expect(validateWriteDeclarations([{name:'x',writes:null}])).toHaveLength(1);
  });
});
