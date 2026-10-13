import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile,rm,lstat,symlink,mkdir,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {makeDeveloperVault} from '../src/developer-vault.js';
const credential={version:1,status:'connected',profile:'full',origin:'https://custom.example',clientId:'c'.repeat(43),clientSecret:'s'.repeat(43),accessToken:'a'.repeat(43),refreshToken:'r'.repeat(43),expiresAt:Date.now()+3600000};
describe('protected managed-runner OAuth vault',()=>{
 it('stores encrypted credentials privately and reuses them without owner copying',async()=>{
  const root=await mkdtemp(join(tmpdir(),'developer-vault-'));try{
   const vault=await makeDeveloperVault(root);await vault.setOAuth('custom',credential);
   const bytes=await readFile(join(root,'custom.oauth.enc'),'utf8');expect(bytes).not.toContain(credential.accessToken);expect(bytes).not.toContain(credential.clientSecret);
   expect((await lstat(join(root,'custom.oauth.enc'))).mode&0o077).toBe(0);
   expect(await (await makeDeveloperVault(root)).getOAuth('custom')).toEqual(credential);
   await vault.deleteOAuth('custom');expect(await vault.getOAuth('custom')).toBe(null);
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('rejects insecure folders, repository storage, symlinks and alias traversal',async()=>{
  const root=await mkdtemp(join(tmpdir(),'developer-unsafe-'));try{
   await chmod(root,0o755);await expect(makeDeveloperVault(root)).rejects.toThrow();await chmod(root,0o700);
   await mkdir(join(root,'.git'));await expect(makeDeveloperVault(root)).rejects.toThrow();await rm(join(root,'.git'),{recursive:true});
   const vault=await makeDeveloperVault(root);await expect(vault.getOAuth('../escape')).rejects.toThrow();
   await symlink(join(root,'vault.key'),join(root,'custom.oauth.enc'));await expect(vault.getOAuth('custom')).rejects.toThrow();
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('serializes refresh across processes and releases the lock after failure',async()=>{
  const root=await mkdtemp(join(tmpdir(),'developer-lock-'));try{
   const a=await makeDeveloperVault(root),b=await makeDeveloperVault(root);let release;let entered;
   const ready=new Promise(r=>{entered=r;});const wait=new Promise(r=>{release=r;});
   const held=a.withOAuthLock('custom',async()=>{entered();await wait;});await ready;
   await expect(b.withOAuthLock('custom',async()=>{})).rejects.toThrow('refresh_in_progress');release();await held;
   await expect(a.withOAuthLock('custom',async()=>{throw Error('fail');})).rejects.toThrow('fail');await b.withOAuthLock('custom',async()=>{});
  }finally{await rm(root,{recursive:true,force:true});}
 });
});
