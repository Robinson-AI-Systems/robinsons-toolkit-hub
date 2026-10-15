import {it,expect} from 'vitest';
import {effectiveServiceAreas,parseServiceAreas,sanitizedServicePolicy,
  narrowHubPassServiceAreas,narrowOAuthFamilyServiceAreas} from '../src/service-area-policy.js';
const input={ownerId:'owner',id:'00000000-0000-4000-8000-000000000001',
  serverName:'stripe',areas:['reports']};
it('intersects per-service owner policy with provider areas and preserves unrelated servers',()=>{
 const p={stripe:['reports'],workspace:['files']};
 expect(effectiveServiceAreas(['billing','reports'],p,'stripe')).toEqual(['reports']);
 expect(effectiveServiceAreas(['billing','reports'],p,'other')).toEqual(['billing','reports']);
 expect(effectiveServiceAreas(['billing'],p,'stripe')).toEqual([]);
 expect(effectiveServiceAreas(['billing'],null,'stripe')).toEqual(['billing']);
 expect(sanitizedServicePolicy(p)).toEqual(p);
 expect(parseServiceAreas('billing,reports')).toEqual(['billing','reports']);
 for(const bad of ['', 'billing,billing','Billing','bad/area',',billing',
   Array(34).fill('a').join(',')])expect(parseServiceAreas(bad)).toBeNull();
 for(const bad of [{stripe:[]},{stripe:['Billing']},{stripe:['x','x']},[],{'BAD':['x']}])
  expect(()=>sanitizedServicePolicy(bad)).toThrow();
 expect(()=>effectiveServiceAreas(['billing'],{stripe:[]},'stripe')).toThrow();
});
it('rejects unverified or malformed owner requests before SQL',async()=>{
 const db={query:()=>{throw Error('Must not reach SQL');}};
 for(const fn of [narrowHubPassServiceAreas,narrowOAuthFamilyServiceAreas]){
  await expect(fn(db,input)).rejects.toThrow();
  for(const changes of [{areas:[]},{areas:['billing','billing']},
    {id:'not-a-uuid'},{serverName:'../bad'},{ownerId:'x y'}])
   await expect(fn(db,{...input,...changes},{ownerVerified:true})).rejects.toThrow();
 }
});
