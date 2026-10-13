// The storage adapter must be an authenticated external secret store, never Git/Library.
// A checkpoint belongs to one serialized runner; it is not a shared refresh-token pool.
import {validDeveloperCredential} from './developer-client.js';
import {RouteError} from './config.js';
const alias=/^[a-z][a-z0-9_-]{0,39}$/;
const fail=()=>{throw new RouteError('Invalid protected developer checkpoint');};
function parse(value){
 if(typeof value!=='string'||Buffer.byteLength(value)>60000)fail();
 let doc;try{doc=JSON.parse(value);}catch{fail();}
 if(doc?.version!==1||doc.runner!=='repo-management'||!doc.records||Array.isArray(doc.records)||
  typeof doc.records!=='object'||Object.keys(doc.records).length>20)fail();
 for(const [name,record]of Object.entries(doc.records))if(!alias.test(name)||
  !validDeveloperCredential(record)||record.status!=='connected')fail();
 return doc;
}
export async function saveDeveloperCheckpoint({vault,names,save}){
 if(!Array.isArray(names)||new Set(names).size!==names.length||names.length>20||typeof save!=='function')fail();
 const records={};for(const name of names){if(!alias.test(name))fail();const r=await vault.getOAuth(name);
  if(!validDeveloperCredential(r)||r.status!=='connected')fail();records[name]=r;}
 const value=JSON.stringify({version:1,runner:'repo-management',records});parse(value);
 // Do not return credentials, even when the external adapter throws a secret-bearing error.
 try{await save(value);}catch{throw new RouteError('Protected checkpoint save failed; retain the current private vault and retry saving before stopping');}
 return {saved:Object.keys(records)};
}
export async function restoreDeveloperCheckpoint({vault,load,origins}){
 let value;try{value=await load();}catch{throw new RouteError('Protected checkpoint load failed');}
 const doc=parse(value),restored=[],existing=[];
 // Check all origins before changing anything; configuration is separately verified.
 for(const [name,r]of Object.entries(doc.records))if(origins?.[name]!==r.origin)fail();
 for(const [name,r]of Object.entries(doc.records)){
  const current=await vault.getOAuth(name);
  if(current){if(!validDeveloperCredential(current)||current.origin!==r.origin)fail();existing.push(name);continue;}
  await vault.setOAuth(name,r);restored.push(name);
 }
 return {restored,existing};
}
