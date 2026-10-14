import {randomUUID} from 'node:crypto';
import {it,expect} from 'vitest';
import {issueProviderCursor,openProviderCursor} from '../src/provider-cursor.js';
import {searchCursorScope} from '../src/search-cursor.js';

const actor={ownerId:'owner',id:randomUUID(),mode:'test',
 profile:'read_only',areas:['gateway']};
const settings={pepper:'synthetic-provider-page-sealing-pepper-over-32'};
const target={name:'stripe',prefix:'stripe',areas:['billing'],grantId:'grant-one',
 origin:'https://rtc.example.com',verifiedAt:'2026-10-14T12:00:00Z'};
const query={query:'test',area:'billing',server:'stripe'};
const scope=(who=actor,which=target,q=query)=>
 searchCursorScope(who,q,[which]);

it('encrypts a five-minute provider continuation and never exposes its opaque value',()=>{
 const at=1_800_000_000_000,privateNext='private_test_cursor.opaque-next';
 const cursor=issueProviderCursor(scope(),privateNext,settings,{now:()=>at});
 expect(cursor).toMatch(/^p\.[A-Za-z0-9_-]+$/);
 expect(cursor.length).toBeLessThanOrEqual(384);
 expect(cursor).not.toContain(privateNext);
 expect(Buffer.from(cursor.slice(2),'base64url').toString('utf8'))
   .not.toContain(privateNext);
 expect(openProviderCursor(cursor,scope(),settings,{now:()=>at+1000}))
   .toBe(privateNext);
 expect(openProviderCursor(cursor,scope(),settings,{now:()=>at+301000}))
   .toBeNull();
});

it('rejects changed callers, query, active grant, verification and endpoint before lookup',()=>{
 const cursor=issueProviderCursor(scope(),'next_2',settings);
 const wrong=[
  scope({...actor,id:randomUUID()}),
  scope({...actor,ownerId:'other'}),
  scope(actor,{...target,grantId:'new'}),
  scope(actor,{...target,verifiedAt:'2026-10-14T12:01:00Z'}),
  scope(actor,{...target,origin:'https://new.example.com'}),
  scope(actor,target,{...query,query:'changed'}),
  scope(actor,target,{...query,area:'other'}),
  scope(actor,target,{...query,server:'other'})
 ];
 for(const changed of wrong)expect(openProviderCursor(cursor,changed,settings)).toBeNull();
 expect(openProviderCursor(cursor,scope(),{pepper:'another-valid-secret-key-over-32-bytes'}))
   .toBeNull();
});

it('fails closed on tampering, cross-kind token replay and unsafe upstream values',()=>{
 const cursor=issueProviderCursor(scope(),'next_1',settings);
 const bytes=Buffer.from(cursor.slice(2),'base64url');bytes[bytes.length-1]^=1;
 const altered='p.'+bytes.toString('base64url');
 for(const bad of [altered,cursor+'x','x.'+cursor.slice(2),'a'.repeat(500),
  'not-a-cursor','']) expect(openProviderCursor(bad,scope(),settings)).toBeNull();
 for(const bad of ['', '../admin','https://host/other','has space','x'.repeat(129)])
  expect(()=>issueProviderCursor(scope(),bad,settings)).toThrow();
 expect(()=>issueProviderCursor(scope(),'valid',{pepper:'short'})).toThrow();
});
