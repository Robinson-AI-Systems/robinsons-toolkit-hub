import {it,expect} from 'vitest';
import handler from '../../../api/results/[handle].js';
function response(){
  return {headers:{},code:0,body:null,setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
}
it('rejects unsupported routes, invalid page and handle before database work',async()=>{
  for(const req of [{method:'PUT',query:{}},{method:'GET',query:{handle:'bad'}},
    {method:'GET',query:{handle:'a'.repeat(43),page:'19'}}]){
    const res=response();await handler({...req,headers:{}},res);
    expect([400,405]).toContain(res.code);
    expect(res.headers['Cache-Control']).toBe('no-store');
  }
});
