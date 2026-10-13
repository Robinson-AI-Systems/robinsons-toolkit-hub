// Optional existing Vercel workload identity; never a replacement for service OAuth.
import {RouteError} from './config.js';
export function developerFetch(env=process.env,fetchImpl=fetch){
 const origins=new Set();
 for(const value of (env.RTOOL_PROTECTED_ORIGINS||'').split(',').filter(Boolean)){
  let u;try{u=new URL(value);}catch{throw new RouteError('Invalid protected origin inventory');}
  if(u.protocol!=='https:'||u.origin!==value||!u.hostname.endsWith('.vercel.app')||u.username||u.password)
   throw new RouteError('Protected developer origins must be exact Vercel HTTPS origins');
  origins.add(value);
 }
 return (url,options={})=>{
  const origin=new URL(url).origin;
  const oidc=env.VERCEL_OIDC_TOKEN;
  const headers={...options.headers};
  if(origins.has(origin)&&typeof oidc==='string'&&oidc){
   headers['x-vercel-trusted-oidc-idp-token']=oidc;
  }
  return fetchImpl(url,{...options,headers,redirect:'error'});
 };
}
