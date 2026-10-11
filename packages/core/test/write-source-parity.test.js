import { describe, expect, it } from 'vitest';
import { validateWriteDeclarations } from '../src/write-contract-check.js';

// Upstream B-7 portable assertions: exact bodies, with only imports rewired.
// The Stripe catalog and defineWrite adapter test remain source-service owned.
const read=()=>({name:'sample_read',writes:false,profiles:['read_only']});
const write=()=>({name:'sample_write',writes:true,writeContract:'defineWrite-v1',
  inputSchema:{type:'object',properties:{
    dryRun:{type:'boolean'},confirm:{type:'boolean'}
  }},safety:'P'});
describe('upstream B-7 portable declaration assertions',()=>{
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
  it('rejects invalid registry shapes instead of treating them as zero tools',()=>{
    expect(validateWriteDeclarations(null)).toHaveLength(1);
    expect(validateWriteDeclarations([{name:'x',writes:null}])).toHaveLength(1);
  });
});
