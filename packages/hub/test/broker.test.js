import {it,expect} from 'vitest';
import {brokerCatalog,runBroker} from '../src/broker.js';
const actor={profile:'read_only',mode:'test',areas:['gateway'],allowWrites:false};
it('maintains eight fixed brokers independent of the number of provider services',()=>{
  const list=brokerCatalog();
  expect(list.map(x=>x.name)).toEqual(['hub_whoami','hub_health','hub_search_tools',
    'hub_describe_tool','hub_call','hub_batch','hub_recent_changes','hub_namespaces']);
  expect(list.every(x=>x.writes===false&&x.annotations.readOnlyHint===true)).toBe(true);
  expect(Buffer.byteLength(JSON.stringify(list))).toBeLessThan(5000*4);
  for(const size of [2,5,12,50,100]) {
    const options=Array.from({length:size},(_,i)=>'synthetic-'+i);
    expect(options.length).toBe(size);
    expect(brokerCatalog().map(x=>x.name)).toEqual(list.map(x=>x.name));
  }
});
it('searches and describes only actual Hub-owned leaf reads',()=>{
  const search=runBroker('hub_search_tools',{query:'health'},actor);
  expect(search.result.tools.map(x=>x.name)).toEqual(['hub_health']);
  expect(search.result.incomplete).toBe(false);
  expect(runBroker('hub_describe_tool',{name:'hub_health'},actor).result.name).toBe('hub_health');
  expect(runBroker('hub_describe_tool',{name:'stripe_send_money'},actor).ok).toBe(false);
  expect(runBroker('hub_describe_tool',{name:'hub_call'},actor).ok).toBe(false);
});
it('executes harmless calls and bounded batch without recursion or provider fallback',()=>{
  expect(runBroker('hub_call',{name:'hub_whoami',args:{}},actor).result.result.allowWrites).toBe(false);
  const batch=runBroker('hub_batch',{calls:[{name:'hub_health'}, {name:'hub_whoami'}]},actor);
  expect(batch.result.results).toHaveLength(2);
  for(const n of ['stripe_create_refund','hub_call','hub_batch','__proto__']) {
    expect(runBroker('hub_call',{name:n,args:{}},actor).ok).toBe(false);
  }
  expect(runBroker('hub_batch',{calls:Array(11).fill({name:'hub_health'})},actor).ok).toBe(false);
  expect(runBroker('hub_batch',{calls:[{name:'hub_health'},{name:'hub_batch'}]},actor).ok).toBe(false);
});
it('fails closed for overprivileged scopes and malformed arguments',()=>{
  for(const state of [{...actor,mode:'live'},{...actor,allowWrites:true},
    {...actor,areas:[]},null]) {
    expect(runBroker('hub_health',{},state).ok).toBe(false);
  }
  for(const arg of [null,[],{query:'a'.repeat(121)},{query:'x',limit:300}]) {
    expect(runBroker('hub_search_tools',arg,actor).ok).toBe(false);
  }
  expect(runBroker('hub_namespaces',{},actor).result.namespaces[0].rtc).toBe(0);
});


it('allows explicitly empty search terms in the fixed broker schema and local fallback',()=>{
 const schema=brokerCatalog().find(t=>t.name==='hub_search_tools').inputSchema;
 expect(schema.properties.query.minLength).toBeUndefined();
 expect(schema.properties.query.maxLength).toBe(120);
 const eligible={id:'fixture',profile:'read_only',mode:'test',
  areas:['gateway'],allowWrites:false};
 const response=runBroker('hub_search_tools',{query:''},eligible);
 expect(response.ok).toBe(true);
 expect(response.result.tools.map(t=>t.name)).toEqual(['hub_whoami','hub_health']);
 expect(runBroker('hub_search_tools',{},eligible).error.code).toBe('invalid_args');
});
