// Actual pinned Stripe module is imported from CI's independent service checkout.
// This is an intentionally bounded compatibility test, never adoption or certification.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as core from '../packages/core/src/http.js';

const serviceFile=resolve('source-stripe/src/core/http.js');
const source=await import(pathToFileURL(serviceFile).href);
const evidence=[];
function outcome(fn){
  try{return {ok:true,value:fn()};}
  catch(error){return {ok:false,name:error?.name||'Error'};}
}
function compare(name,fn){
  const original=outcome(()=>fn(source));
  const portable=outcome(()=>fn(core));
  assert.deepEqual(portable,original,'HTTP source mismatch: '+name);
  evidence.push(name);
}
function response(mod){
  const headers={};
  const res={setHeader(k,v){headers[k]=v;return this;},
    status(n){this.statusCode=n;return this;},
    send(v){this.body=v;return this;}};
  mod.send(res,201,{value:'safe'});
  return {headers,code:res.statusCode,body:res.body};
}
function method(mod){
  const headers={};
  const res={setHeader(k,v){headers[k]=v;return this;},
    status(n){this.statusCode=n;return this;},
    send(v){this.body=v;return this;}};
  const allowed=mod.only(res,{method:'DELETE'},['GET','POST']);
  return {allowed,headers,status:res.statusCode,body:res.body};
}
compare('issuer configuration',mod=>mod.publicOrigin({PUBLIC_BASE_URL:'https://example.test/'}));
compare('reject untrusted issuer',mod=>mod.publicOrigin({PUBLIC_BASE_URL:'http://example.test'}));
compare('HTTPS JSON response framing',response);
compare('405 method refusal',method);
compare('GET parameters',mod=>mod.paramsOf({method:'GET',query:{key:'safe'}}));
compare('parsed JSON body',mod=>mod.paramsOf({method:'POST',
  headers:{'content-type':'application/json'},body:{record:'safe'}}));
compare('encoded JSON string',mod=>mod.paramsOf({method:'POST',
  headers:{'content-type':'application/json'},body:'{"record":"safe"}'}));
compare('form fields',mod=>mod.paramsOf({method:'POST',
  headers:{'content-type':'application/x-www-form-urlencoded'},body:'a=1&b=2'}));
compare('reject oversized string',mod=>mod.paramsOf({method:'POST',
  headers:{'content-type':'application/json'},body:'x'.repeat(16385)}));

// Do not call the portable extractor a drop-in replacement. Both current
// modules enforce structured size, but only private core rejects active getters.
const oversized={method:'POST',headers:{'content-type':'application/json'},
  body:{payload:'x'.repeat(16385)}};
assert.equal(outcome(()=>source.paramsOf(oversized)).ok,false,
  'Pinned source must refuse oversized framework-preparsed JSON');
assert.equal(outcome(()=>core.paramsOf(oversized)).ok,false,
  'Current reviewed portable source must now reject oversized framework bodies');
assert.equal(typeof source.incomingBodyWithinLimit,'function',
  'The host-owned original transport validator must remain present');
assert.equal(typeof core.incomingBodyWithinLimit,'function',
  'The current reviewed Stripe HTTP body validator must be ported verbatim');
const inconsistent={method:'POST',headers:{'content-length':'9'},body:{
  payload:'x'.repeat(16385)}};
assert.equal(source.incomingBodyWithinLimit(inconsistent),false,
  'Current reviewed Stripe source must reject oversized structured bodies');
assert.equal(core.incomingBodyWithinLimit(inconsistent),false,
  'Private adapted helper must reject oversized parsed bodies');
let getterCalls=0;
const active={};
Object.defineProperty(active,'data',{enumerable:true,get(){getterCalls++;return 'unsafe';}});
// Source now bounds pre-parsed bodies, but its JSON.stringify touches active
// getters. Only call it against this inert local fixture: the difference is
// an explicit service-owned security handoff, never a reason to weaken core.
assert.equal(source.incomingBodyWithinLimit({method:'POST',
  headers:{'content-length':'50'},body:active}),true);
assert.equal(getterCalls,1,'Current source invokes active getter before refusal');
getterCalls=0;
assert.equal(core.incomingBodyWithinLimit({method:'POST',
  headers:{'content-length':'50'},body:active}),false);
assert.equal(getterCalls,0,'Adapted core must not invoke active body getters');
console.log(JSON.stringify({source:'actual independently checked-out Stripe service',
  compatibleCases:evidence.length,
  knownIncompatible:['current source invokes active getters from a framework-preparsed body'],
  currentSourceHttpAdapted:true,hostRawTransportStillServiceOwned:true,
  adopted:false,releaseReady:false}));
