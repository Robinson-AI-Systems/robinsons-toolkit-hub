import {describe,it,expect,vi} from 'vitest';
import {createGuardedMcpDispatcher} from '../src/mcp-dispatch.js';

function fixture() {
  const original={totalBytes:12000,records:[{value:'owned',nested:{account:'tenant-a'}}]};
  const page={offset:0,nextOffset:null,detail:{tenant:'tenant-a'}};
  const registry={tools:[{name:'read_large',writes:false}],
    handlers:{read_large:vi.fn(async()=>({value:'A'.repeat(12000)}))}};
  const splitResult=vi.fn(()=>original);
  const resultPage=vi.fn(()=>page);
  const db={putScopedResult:vi.fn(async()=>{})};
  const adapter=createGuardedMcpDispatcher({registry,authorizeTool:()=>true,
    shapeResult:data=>({content:[{type:'text',text:JSON.stringify(data)}]}),
    readDetail:value=>value,splitResult,resultPage,formatError:()=>null});
  const dispatch=()=>adapter.dispatch({name:'read_large',args:{},
    connection:{profile:'read_only',mode:'test',resultScope:'tenant-a'},db});
  return {original,page,registry,splitResult,resultPage,db,dispatch};
}
const decoded=value=>JSON.parse(value.content[0].text);

describe('portable scoped results freeze source adapter paging boundaries',()=>{
  it('rejects active or cyclic split payloads without evaluating their getters',async()=>{
    let getters=0;
    const forged={totalBytes:12000};
    Object.defineProperty(forged,'records',{enumerable:true,get(){
      getters++;return [{value:'outside-tenant'}];
    }});
    const nested={totalBytes:12000,records:[{safe:{}}]};
    Object.defineProperty(nested.records[0].safe,'secret',{enumerable:true,get(){
      getters++;return 'private';
    }});
    const cyclic={totalBytes:12000};cyclic.self=cyclic;
    for(const value of [forged,nested,cyclic,{totalBytes:12000,records:[new Date()]}]){
      const f=fixture();
      f.splitResult.mockReturnValueOnce(value);
      const result=await f.dispatch();
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/private|outside-tenant/);
      expect(f.resultPage).not.toHaveBeenCalled();
      expect(f.db.putScopedResult).not.toHaveBeenCalled();
    }
    expect(getters).toBe(0);
  });
  it('keeps scoped body immutable and detached from a late adapter mutation',async()=>{
    const f=fixture();
    f.resultPage.mockImplementationOnce(body=>{
      expect(body).not.toBe(f.original);
      expect(Object.isFrozen(body)).toBe(true);
      expect(Object.isFrozen(body.records[0].nested)).toBe(true);
      f.original.records[0].nested.account='tenant-other';
      return {offset:0,nextOffset:null};
    });
    const result=await f.dispatch();
    expect(result.isError).toBeUndefined();
    const stored=f.db.putScopedResult.mock.calls[0][0];
    expect(stored.connection).toBe('tenant-a');
    expect(stored.body.records[0].nested.account).toBe('tenant-a');
    expect(Object.isFrozen(stored.body.records[0].nested)).toBe(true);
    expect(stored.body).not.toBe(f.original);
  });
  it('detaches returned page from mutations during the storage await',async()=>{
    const f=fixture();
    f.db.putScopedResult.mockImplementationOnce(async()=>{
      f.page.detail.tenant='tenant-other';
      f.page.offset=999;
    });
    const response=await f.dispatch();
    expect(response.isError).toBeUndefined();
    expect(decoded(response)).toMatchObject({offset:0,detail:{tenant:'tenant-a'},
      records:1,expiresInHours:24});
  });
  it('refuses active or protected page overrides without persistence',async()=>{
    const f=fixture(),bad={offset:0};
    let getters=0;
    Object.defineProperty(bad,'nextOffset',{enumerable:true,get(){getters++;return 1;}});
    f.resultPage.mockReturnValueOnce(bad);
    expect((await f.dispatch()).isError).toBe(true);
    expect(getters).toBe(0);
    expect(f.db.putScopedResult).not.toHaveBeenCalled();
    const protectedPage=fixture();
    protectedPage.resultPage.mockReturnValueOnce({handle:'forged',offset:0});
    expect((await protectedPage.dispatch()).isError).toBe(true);
    expect(protectedPage.db.putScopedResult).not.toHaveBeenCalled();
  });
});
