import {randomUUID} from 'node:crypto';
import {it,expect} from 'vitest';
import {issueFleetCursor,openFleetCursor,maxFleetDepth} from '../src/fleet-cursor.js';
import {searchCursorScope} from '../src/search-cursor.js';

const actor={id:randomUUID(),ownerId:'synthetic-owner',mode:'test',
 profile:'read_only',areas:['gateway']};
const settings={pepper:'synthetic-hub-fleet-cursor-pepper-is-over-32-bytes'};
const roster=Array.from({length:5},(_,i)=>({
 name:'svc'+i,prefix:'svc'+i,areas:['billing'],grantId:'synthetic-grant-'+i,
 origin:'https://service'+i+'.example.net',
 verifiedAt:'2026-10-14T12:00:00Z'
}));
const filters={query:'invoice',area:'billing'};
const scope=(a=actor,r=roster,q=filters)=>searchCursorScope(a,q,r);
const state={o:3,p:[
 {i:0,n:{kind:'offset',value:'12'},d:2},
 {i:1,n:{kind:'page',value:'4'},d:3},
 {i:2,n:{kind:'cursor',value:'not-a-public-token'},d:4}
]};

it('seals the whole provider queue without disclosing offsets or upstream cursors',()=>{
 const now=1_800_000_000_000;
 const token=issueFleetCursor(scope(),state,settings,{now:()=>now});
 expect(token).toMatch(/^f\.[A-Za-z0-9_-]+$/);
 expect(token.length).toBeLessThanOrEqual(1280);
 expect(JSON.stringify(token)).not.toContain('not-a-public-token');
 const opaque=Buffer.from(token.slice(2),'base64url').toString('utf8');
 expect(opaque).not.toContain('not-a-public-token');
 expect(opaque).not.toContain('synthetic-grant-0');
 expect(openFleetCursor(token,scope(),settings,{now:()=>now+1000})).toEqual(state);
 expect(openFleetCursor(token,scope(),settings,{now:()=>now+301000})).toBeNull();
});

it('rejects changes to exact caller, filter, grant, origin, verification or roster',()=>{
 const token=issueFleetCursor(scope(),state,settings);
 const wrong=[
  scope({...actor,id:randomUUID()}),
  scope({...actor,ownerId:'different-owner'}),
  scope(actor,roster,{...filters,query:'changed'}),
  scope(actor,roster,{...filters,area:'admin'}),
  scope(actor,roster.slice(1)),
  scope(actor,roster.map((s,i)=>i===0?{...s,grantId:'rotated'}:s)),
  scope(actor,roster.map((s,i)=>i===0?{...s,origin:'https://changed.example.net'}:s)),
  scope(actor,roster.map((s,i)=>i===0?{...s,verifiedAt:'2026-10-14T13:00:00Z'}:s))
 ];
 for(const s of wrong)expect(openFleetCursor(token,s,settings)).toBeNull();
 expect(openFleetCursor(token,scope(),{pepper:'another-synthetic-valid-pepper-over-32-bytes'}))
  .toBeNull();
});

it('fails closed on malformed or tampered state and never interprets a provider token as a fleet state',()=>{
 const token=issueFleetCursor(scope(),state,settings);
 const bytes=Buffer.from(token.slice(2),'base64url');
 bytes[bytes.length-1]^=1;
 for(const bad of ['p.'+token.slice(2),'not-a-token','f.'+'a'.repeat(1290),
  'f.'+bytes.toString('base64url'),token+'x',token.slice(0,-1)+'*'])
  expect(openFleetCursor(bad,scope(),settings)).toBeNull();
 for(const invalid of [
  {o:0,p:[]},{o:101,p:[]},{o:3,p:[{i:4,n:{kind:'offset',value:'1'},d:1}]},
  {o:3,p:[{i:0,n:{kind:'offset',value:'1'},d:1},
    {i:0,n:{kind:'offset',value:'2'},d:2}]},
  {o:3,p:[{i:0,n:{kind:'cursor',value:'../../admin'},d:1}]},
  {o:3,p:[{i:0,n:{kind:'cursor',value:'ok'},d:maxFleetDepth+1}]},
  {o:3,p:[{i:0,n:{kind:'page',value:'0'},d:1}]},
  {o:3,p:[{i:0,n:null,d:1}]},
  {o:3,p:[...state.p,{i:2,n:{kind:'cursor',value:'other'},d:3}]}
 ])expect(()=>issueFleetCursor(scope(),invalid,settings)).toThrow();
});

it('allows a complete 100-service bound without granting new scope',()=>{
 const s={o:100,p:[{i:99,n:{kind:'offset',value:'999'},d:maxFleetDepth}]};
 const token=issueFleetCursor(scope(),s,settings);
 expect(openFleetCursor(token,scope(),settings)).toEqual(s);
 expect(token.length).toBeLessThan(1280);
});
