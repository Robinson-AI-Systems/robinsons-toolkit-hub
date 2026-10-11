// Execute the reviewed original Stripe dispatch function beside the portable
// dispatcher. Only the necessary source service policy/result functions are
// injected through a deterministic test shim; no SDK or Stripe provider invoked.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { gitBlobSha } from '../../../scripts/check-original-assertion-bodies.mjs';
import { createGuardedMcpDispatcher } from '../src/mcp-dispatch.js';
import {
  dispatchReadOnlyTool, isToolAllowed, isGuardedTestWrite, shapeToolResult,
  readDetail, splitResult, resultPage, toStripeToolError
} from './support/upstream-dispatch-runtime.js';

const asResult = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const bodyOf = envelope => JSON.parse(envelope.content[0].text);
function fixture({large = false, storage = true, guarded = false, nested = false,
  resultScope = 'isolated-scope', profile = 'full', noHandler = false, throwError = false} = {}) {
  const calls = { handled: 0, reads: 0, stored: [] };
  const payload = large ? Array.from({length:140}, (_,i)=>({id:i, text:'x'.repeat(100)}))
    : {ok:true,account:'test-only'};
  const handler = async (_args,ctx) => {
    calls.handled++;
    if (throwError) throw Error('private provider error');
    if (nested) return ctx.runRead('stripe_safe_read',{});
    return asResult(payload);
  };
  const registry = {
    tools: [
      {name:'stripe_safe_read',writes:false},
      {name:'stripe_nested_read',writes:false},
      {name:'stripe_guarded_write',writes:true,guardedTest:guarded}
    ],
    handlers: {
      stripe_safe_read: async () => {calls.reads++;if (throwError) throw Error('private provider error');return asResult(payload);},
      stripe_nested_read:handler,
      stripe_guarded_write:handler
    }
  };
  if (noHandler) delete registry.handlers.stripe_safe_read;
  const connection={mode:'test',profile,resultScope,listing:'catalog'};
  const db=storage?{putScopedResult:vi.fn(async item=>{calls.stored.push(item);})}:{};
  const portable=createGuardedMcpDispatcher({
    registry,
    authorizeTool: (tool,c) => isToolAllowed(tool,c.profile,{
      allowWrites:isGuardedTestWrite(tool,c)
    }),
    shapeResult:shapeToolResult, readDetail, splitResult, resultPage,
    formatError:toStripeToolError, skipDetailFor:name=>name==='stripe_get_result'
  });
  return {registry,connection,db,portable,calls};
}
async function invoke(f,name,args={}) {
  return {
    original:await dispatchReadOnlyTool({registry:f.registry,name,args,
      connection:f.connection,db:f.db}),
    portable:await f.portable.dispatch({name,args,connection:f.connection,db:f.db})
  };
}

describe('K-3 executed original Stripe MCP dispatch compatibility', () => {
  it('pins whole original runtime and checks that function body is unchanged', () => {
    const originalPath=fileURLToPath(new URL('../../../docs/audits/upstream/mcp-server.js.b64',import.meta.url));
    const entire=Buffer.from(readFileSync(originalPath,'utf8').trim(),'base64').toString('utf8');
    expect(gitBlobSha(entire)).toBe('51309da34c8aab8f44c67411fe83c89367d664b6');
    const begin=entire.indexOf('export async function dispatchReadOnlyTool(');
    const end=entire.indexOf('export function createMcpHandler(');
    expect(begin).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(begin);
    const isolatedPath=fileURLToPath(new URL('./support/upstream-dispatch-runtime.js',import.meta.url));
    expect(readFileSync(isolatedPath,'utf8')).toContain(entire.slice(begin,end));
  });
  it('matches allowed read payloads, requested fields and nested guarded reads',async()=>{
    for (const name of ['stripe_safe_read','stripe_nested_read']) {
      const f=fixture({nested:true});
      const result=await invoke(f,name,{detail:'full',fields:'ok'});
      expect(result.portable).toEqual(result.original);
      expect(result.portable.isError).toBeUndefined();
      expect(f.calls.stored).toHaveLength(0);
      if(name==='stripe_nested_read')expect(f.calls.reads).toBe(2);
    }
  });
  it('matches hidden write, unknown tool and missing registered handler denials',async()=>{
    for(const [name,opts] of [
      ['stripe_guarded_write',{}],['stripe_missing',{}],
      ['stripe_safe_read',{noHandler:true}]
    ]) {
      const f=fixture(opts);
      const {original,portable}=await invoke(f,name,{confirm:true});
      expect(portable).toEqual(original);
      expect(portable.isError).toBe(true);
      expect(f.calls.handled).toBe(0);
      expect(f.calls.stored).toHaveLength(0);
    }
  });
  it('matches explicitly guarded TEST write metadata without granting owner money consent',async()=>{
    const f=fixture({guarded:true});
    const {original,portable}=await invoke(f,'stripe_guarded_write',{dryRun:true});
    expect(portable).toEqual(original);
    expect(bodyOf(portable)).toEqual({ok:true,account:'test-only'});
    // This is only a fake policy injection. Actual source guards own all money.
    expect(f.calls.handled).toBe(2);
  });
  it('matches oversized storage contract and distinguishes intentional source summary wording',async()=>{
    const f=fixture({large:true});
    const {original,portable}=await invoke(f,'stripe_safe_read');
    const a=bodyOf(original),b=bodyOf(portable);
    expect(original.isError).toBeUndefined();
    expect(portable.isError).toBeUndefined();
    expect(a.handle).toMatch(/^res_[A-Za-z0-9_-]{24}$/);
    expect(b.handle).toMatch(/^res_[A-Za-z0-9_-]{24}$/);
    expect({...b,handle:a.handle,summary:a.summary}).toEqual(a);
    expect(f.calls.stored).toHaveLength(2);
    for (const item of f.calls.stored) {
      expect(item.connection).toBe('isolated-scope');
      expect(item.body.totalBytes).toBe(a.totalBytes);
      expect(item.body.value).toEqual(Array.from({length:140},(_,i)=>({id:i,text:'x'.repeat(100)})));
    }
    expect(a.summary).toContain('TEST connection only');
    expect(b.summary).toContain('scoped connection only');
  });
  it('refuses oversized results without scoped store, and keeps provider errors generic',async()=>{
    for(const opts of [{large:true,storage:false},{throwError:true}]) {
      const f=fixture(opts);
      const {original,portable}=await invoke(f,'stripe_safe_read');
      expect(portable).toEqual(original);
      expect(portable.isError).toBe(true);
      expect(f.calls.stored).toHaveLength(0);
    }
  });
  it('portable runtime additionally denies unauthorized prototype-inherited dispatch',async()=>{
    const f=fixture();
    const inherited=()=>asResult({unsafe:true});
    f.registry.handlers=Object.create({stripe_safe_read:inherited});
    const safe=await f.portable.dispatch({name:'stripe_safe_read',connection:f.connection,db:f.db});
    expect(safe.isError).toBe(true);
    expect(f.calls.stored).toHaveLength(0);
  });
});
