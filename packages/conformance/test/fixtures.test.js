import { describe, expect, it } from 'vitest';
import { startFakeServer } from '../fake-server/server.js';
import { runConformance } from '../src/run.js';
import { fixtureOptions, recoverResult } from '../src/fixtures.js';
const fixtures = { read:{name:'fake_read_record',args:{selector:'exact'}},
  largeRead:{name:'fake_read_record',args:{selector:'large'}}, write:{name:'fake_write_record',args:{}},
  guarded:{name:'fake_delete_record',args:{}},field:'value',valueArgument:'value' };
describe('server-owned fixture selectors retain RTC assertions',()=>{
  it('runs the same wire checks using explicit real tool names and required input arguments',async()=>{
    const f=await startFakeServer();
    try{
      const report=await runConformance({url:f.url,passes:f.passes,oauth:f.oauth,fixtures});
      expect(report.checks.filter(c=>!c.ok&&!c.skipped)).toEqual([]);
      expect(report.checks.find(c=>c.name==='writes').ok).toBe(true);
    }finally{await f.close();}
  });
  it('cannot choose a write as its read or omit a tool and still pass',async()=>{
    const f=await startFakeServer();
    try{
      for(const name of ['fake_write_record','fake_not_present']){
        const report=await runConformance({url:f.url,passes:f.passes,fixtures:{...fixtures,read:{name,args:{}}}});
        expect(report.checks.find(c=>c.name==='reads').ok).toBe(false);
      }
    }finally{await f.close();}
  });
  it('refuses callback bypasses, unsafe selectors and reserved control arguments',()=>{
    for(const value of [{...fixtures,verify:()=>true},{...fixtures,field:'__proto__'},
      {...fixtures,write:{name:'fake_write_record',args:{dryRun:true}}},
      {...fixtures,read:{name:'fake_read_record',args:{fields:['value']}}}])
      expect(()=>fixtureOptions(value)).toThrow();
    const copy=fixtureOptions(fixtures);copy.read.args.selector='changed';
    expect(fixtures.read.args.selector).toBe('exact');
  });
});
describe('complete bounded numbered result recovery',()=>{
  const initial={data:{ok:true,handle:'owned-result'}};
  const chunks=['α'.repeat(2000),'B'.repeat(2000)];
  const bytes=Buffer.byteLength(chunks.join(''));
  const page=n=>({status:200,data:{ok:true,result:{page:n,pages:2,bytes,content:chunks[n-1],next:n===1?2:null}}});
  it('recovers UTF-8 bytes and follows the exact owned handle on every page',async()=>{
    const paths=[];
    const result=await recoverResult(async(_url,_pass,path)=>{paths.push(path);return page(paths.length);},'http://localhost','in-memory',initial);
    expect(result).toBe(chunks.join(''));
    expect(paths).toEqual(['/api/results/owned-result','/api/results/owned-result?page=2']);
  });
  for(const fault of ['bytes','next','page','size','permission'])it('refuses '+fault+' rather than certifying incomplete recovery',async()=>{
    let n=0;
    await expect(recoverResult(async()=>{
      const r=page(++n);
      if(fault==='bytes')r.data.result.bytes++;
      if(fault==='next')r.data.result.next=1;
      if(fault==='page')r.data.result.page=3;
      if(fault==='size')r.data.result.content='x'.repeat(4097);
      if(fault==='permission')r.status=404;
      return r;
    },'http://localhost','in-memory',initial)).rejects.toThrow(/§7/);
  });
});
