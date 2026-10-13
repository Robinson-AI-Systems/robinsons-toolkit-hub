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
