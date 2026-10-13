import {it,expect} from 'vitest';
import {parseOAuthForm} from '../src/oauth-form.js';
it('refuses duplicate token and client identifiers and oversized form data',()=>{
  expect(parseOAuthForm({body:'client_id=one&client_id=two'})).toBeNull();
  expect(parseOAuthForm({body:'token=a&token=b'})).toBeNull();
  expect(parseOAuthForm({body:'x='.repeat(3000)})).toBeNull();
  expect(parseOAuthForm({body:{token:'x'.repeat(5000)}})).toBeNull();
});
it('accepts single bounded urlencoded and ordinary object bodies',()=>{
  expect(parseOAuthForm({body:'client_id=client123&token=opaque'}).get('token')).toBe('opaque');
  expect(parseOAuthForm({body:{client_id:'client123',token:'opaque'}}).get('client_id'))
    .toBe('client123');
});
it('accepts Node-parsed browser forms and still rejects duplicate arrays and inherited objects',async()=>{
 const {parse}=await import('node:querystring');
 const fields=parse('client_id=client123&grant_type=refresh_token&refresh_token=FAKE_TOKEN');
 expect(Object.getPrototypeOf(fields)).toBeNull();expect(parseOAuthForm({body:fields}).get('client_id')).toBe('client123');
 expect(parseOAuthForm({body:parse('client_id=one&client_id=two')})).toBeNull();
 expect(parseOAuthForm({body:Object.assign(Object.create({client_id:'inherited'}),{grant_type:'refresh_token'})})).toBeNull();
});
