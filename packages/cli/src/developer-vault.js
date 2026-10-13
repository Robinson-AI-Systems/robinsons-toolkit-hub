// Explicit managed-runner vault. AES-GCM files and a separate private local key;
// filesystem ownership is the trust boundary. Never use a repo/Library artifact folder.
import {open,mkdir,lstat,rename,unlink} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {constants} from 'node:fs';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {validDeveloperCredential} from './developer-client.js';
import {RouteError} from './config.js';
const alias=/^[a-z][a-z0-9_-]{0,39}$/;
const deny=()=>{throw new RouteError('Protected developer vault unavailable or unsafe');};
async function safeFile(path,{missing=false}={}){
 let st;try{st=await lstat(path);}catch(e){if(missing&&e.code==='ENOENT')return null;deny();}
 if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)!==0||st.uid!==process.getuid())deny();return st;
}
async function read(path){
 await safeFile(path);const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const st=await f.stat();if(st.size>16384||st.uid!==process.getuid()||(st.mode&0o077)!==0)deny();return await f.readFile('utf8');}finally{await f.close();}
}
export async function makeDeveloperVault(directory){
 if(process.platform==='win32'||typeof directory!=='string'||!directory.startsWith('/'))deny();
 const root=resolve(directory);
 if(root==='/'||root===resolve('.'))deny();
 // Refuse symlinked ancestors and any Git checkout, even a different working tree.
 for(let p=root;;p=dirname(p)){
  try{if((await lstat(p)).isSymbolicLink())deny();}catch(e){if(e.code!=='ENOENT')throw e;}
  try{await lstat(join(p,'.git'));deny();}catch(e){if(e.code!=='ENOENT')throw e;}
  if(dirname(p)===p)break;
 }
 try{await mkdir(root,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
 const st=await lstat(root);if(!st.isDirectory()||(st.mode&0o077)!==0||st.uid!==process.getuid())deny();
 const keyPath=join(root,'vault.key');
 if(!await safeFile(keyPath,{missing:true})){
  try{const f=await open(keyPath,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
   try{await f.writeFile(randomBytes(32).toString('base64url'));}finally{await f.close();}
  }catch(e){if(e.code!=='EEXIST')throw e;}
 }
 const key=Buffer.from(await read(keyPath),'base64url');if(key.length!==32)deny();
 const path=name=>{if(!alias.test(name||''))deny();return join(root,name+'.oauth.enc');};
 return {
  async getOAuth(name){
   const file=path(name);if(!await safeFile(file,{missing:true}))return null;
   try{const box=JSON.parse(await read(file));
    const iv=Buffer.from(box.iv,'base64url'),tag=Buffer.from(box.tag,'base64url');
    if(box.version!==1||iv.length!==12||tag.length!==16)deny();
    const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from('rtool-developer:'+name));decipher.setAuthTag(tag);
    const value=JSON.parse(Buffer.concat([decipher.update(Buffer.from(box.data,'base64url')),decipher.final()]).toString());
    if(!validDeveloperCredential(value))deny();return value;
   }catch{deny();}
  },
  async setOAuth(name,value){
   if(!validDeveloperCredential(value))deny();const file=path(name);await safeFile(file,{missing:true});
   const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('rtool-developer:'+name));
   const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
   const box=JSON.stringify({version:1,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:data.toString('base64url')});
   const tmp=file+'.'+randomBytes(8).toString('hex');const f=await open(tmp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
   try{await f.writeFile(box);await f.sync();await f.close();await rename(tmp,file);}catch(e){await f.close().catch(()=>{});await unlink(tmp).catch(()=>{});throw e;}
  },
  async deleteOAuth(name){const file=path(name);if(!await safeFile(file,{missing:true}))return false;await unlink(file);return true;},
  async withOAuthLock(name,fn){
   const file=path(name)+'.lock';let f;
   try{f=await open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);}
   catch(e){if(e.code==='EEXIST')throw new RouteError('developer_refresh_in_progress_retry_later');throw e;}
   try{return await fn();}finally{await f.close();await unlink(file);}
  }
 };
}
