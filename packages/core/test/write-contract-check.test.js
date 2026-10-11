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
