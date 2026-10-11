import { describe, expect, it } from 'vitest';
import { validateWriteDeclarations } from '../src/write-contract-check.js';
const basicRead = () => ({name:'example_read',writes:false});
const guardedWrite = () => ({ name:'example_update',writes:true,
  writeContract:'defineWrite-v1',inputSchema:{type:'object',properties:{
    dryRun:{type:'boolean'},confirm:{type:'boolean'} }} });

describe('Stripe-extracted write declaration contract', () => {
  it('accepts declared reads and guarded writes, with explicit provider-derived money metadata', () => {
    const out = guardedWrite();
    out.name='example_refund';out.moneyOut=true;out.moneySpec='provider-derived';
    expect(validateWriteDeclarations([basicRead(),guardedWrite(),out])).toEqual([]);
  });
  it('rejects absent declarations, hidden writes and invalid guard input schema', () => {
    expect(validateWriteDeclarations(null)).toContain('Tool registry must provide a tools array');
    expect(validateWriteDeclarations([{name:'forgot'}])[0]).toMatch(/missing explicit writes/);
    const unsafe={...guardedWrite(),inputSchema:{type:'object',properties:{confirm:{type:'string'}}}};
    const findings=validateWriteDeclarations([unsafe]);
    expect(findings.join(' ')).toMatch(/dryRun/);
    expect(findings.join(' ')).toMatch(/confirm/);
    expect(validateWriteDeclarations([{...guardedWrite(),writeContract:'unprotected'}]).join(' '))
      .toMatch(/missing guarded/);
  });
  it('requires money to be a write, with a provider-derived amount specification', () => {
    expect(validateWriteDeclarations([{...basicRead(),moneyOut:true}]).join(' '))
      .toMatch(/money-out safety marker requires writes/);
    expect(validateWriteDeclarations([{...guardedWrite(),moneyOut:true}]).join(' '))
      .toMatch(/provider-derived money spec/);
    expect(validateWriteDeclarations([{...basicRead(),moneySpec:'provider-derived'}]).join(' '))
      .toMatch(/read-only tool cannot/);
  });
  it('does not mutate tool metadata, and reports each faulty entry by name', () => {
    const tool={...guardedWrite(),moneyOut:true};
    const before=structuredClone(tool);
    expect(validateWriteDeclarations([tool]).join(' ')).toContain('example_update');
    expect(tool).toEqual(before);
  });
});

describe('portable original-source B-7 declaration assertions',()=>{
  const read=()=>({name:'sample_read',writes:false,profiles:['read_only']});
  const write=()=>({...guardedWrite(),name:'sample_write',safety:'P'});
  it('accepts the current registered read tools and properly declared guarded writes',()=>{
    // The source catalog assertion is server-owned: check a synthetic registry only.
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
    const b=write();b.inputSchema={type:'object',properties:{
      dryRun:{type:'boolean'},confirm:{type:'string'}}};
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
