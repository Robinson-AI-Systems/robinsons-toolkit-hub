import {describe,it,expect} from 'vitest';
import {developerFetch} from '../src/developer-protection.js';
describe('origin-bound existing Vercel development identity',()=>{
 it('adds hosting identity only to an explicitly pinned deployment and retains native OAuth',async()=>{
  const calls=[];const f=developerFetch({RTOOL_PROTECTED_ORIGINS:'https://custom.vercel.app',VERCEL_OIDC_TOKEN:'FAKE_OIDC_IDENTITY'},async(...args)=>{calls.push(args);});
  await f('https://custom.vercel.app/api/mcp',{headers:{authorization:'Bearer FAKE_NATIVE_OAUTH'}});
  expect(calls[0][1].headers).toEqual({authorization:'Bearer FAKE_NATIVE_OAUTH','x-vercel-trusted-oidc-idp-token':'FAKE_OIDC_IDENTITY'});
  expect(calls[0][1].redirect).toBe('error');
  await f('https://other.vercel.app/api/mcp',{headers:{authorization:'Bearer OTHER'}});expect(calls[1][1].headers['x-vercel-trusted-oidc-idp-token']).toBeUndefined();
 });
 it('does not invent hosting credentials or send an identity to unrelated servers',async()=>{
  const calls=[];const f=developerFetch({VERCEL_OIDC_TOKEN:'FAKE_OIDC_IDENTITY'},async(...args)=>{calls.push(args);});
  await f('https://provider.example/api/mcp');expect(calls[0][1].headers).toEqual({});
  expect(()=>developerFetch({RTOOL_PROTECTED_ORIGINS:'https://attacker.example'})).toThrow();
  expect(()=>developerFetch({RTOOL_PROTECTED_ORIGINS:'https://custom.vercel.app/path'})).toThrow();
 });
});
