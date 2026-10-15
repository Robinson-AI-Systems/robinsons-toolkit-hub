// L-2: opt-in local Ollama only. Never hosted, proxied, or auto-cloud.
// No filesystem or provider pass is sent to the model server. The existing
// confirmed create-only writer is the ONLY way to persist an inference result.
import {request as httpRequest} from 'node:http';
import {createConfirmedLocalFile} from './local-file-create.js';
import {ToolError} from './http.js';

const refuse=(message='Local Ollama request refused')=>{
 throw new ToolError(message,-32602);
};
const modelPattern=/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,99}$/;
const allowedEndpoints=new Set(['/api/version','/api/tags','/api/ps',
 '/api/generate','/api/chat','/api/embed']);
const MAX_REPLY=131072,MAX_INLINE=6500,MAX_PROMPT=4096,MAX_TEXT=16000;
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.getPrototypeOf(o)===Object.prototype;
const textBytes=(value,max)=>typeof value==='string'&&
 Buffer.byteLength(value,'utf8')<=max&&!value.includes('\0');
const props=(v,known)=>{
 if(!plain(v)||Object.keys(v).some(x=>!known.includes(x)))refuse();
};
const modelSchema={type:'string',minLength:1,maxLength:100};
const resultOptions={
 root:{type:'integer',minimum:0},
 outputFile:{type:'string',minLength:1,maxLength:1024},
 confirm:{type:'boolean',const:true}
};
const requestOptions={
 timeoutMs:{type:'integer',minimum:1000,maximum:60000},
 numPredict:{type:'integer',minimum:1,maximum:512}
};
function tool(name,description,properties={},required=[],readOnly=true) {
 return Object.freeze({
  name:'local.ollama_'+name,description,
  inputSchema:{type:'object',properties,required,additionalProperties:false},
  annotations:{readOnlyHint:readOnly,destructiveHint:false,
   idempotentHint:false,openWorldHint:false}
 });
}
export const LOCAL_OLLAMA_TOOLS=Object.freeze([
 tool('status','Check the explicitly configured loopback Ollama server; no cloud fallback.'),
 tool('models','List downloaded local models (bounded inventory).'),
 tool('running','List models currently loaded into local Ollama memory.'),
 tool('generate','Generate one bounded local completion; no automatic tool calls.',
  {model:modelSchema,prompt:{type:'string',maxLength:MAX_PROMPT},
   ...requestOptions,...resultOptions},['model','prompt'],false),
 tool('chat','Generate a bounded local chat reply; tools/function calls disabled.',
  {model:modelSchema,messages:{type:'array',minItems:1,maxItems:10,
    items:{type:'object',properties:{role:{type:'string',enum:['system','user','assistant']},
      content:{type:'string',maxLength:2048}},required:['role','content'],
      additionalProperties:false}},...requestOptions,...resultOptions},
  ['model','messages'],false),
 tool('embed','Generate a local numeric embedding; large vectors require confirmed private file output.',
  {model:modelSchema,input:{type:'string',maxLength:MAX_PROMPT},
   timeoutMs:requestOptions.timeoutMs,...resultOptions},['model','input'],false)
]);
/**
 * Trust only a loopback HTTP origin supplied by the LOCAL CLI environment,
 * never tool arguments. Mapping localhost to numeric 127.0.0.1 also prevents
 * DNS/hosts-file interception and Node environment proxy redirection.
 */
export function configuredLocalOllama(env=process.env){
 const raw=env?.OLLAMA_BASE_URL;
 if(typeof raw!=='string'||raw.length<10||raw.length>160)return null;
 try {
  const u=new URL(raw);
  if(u.protocol!=='http:'||u.pathname!=='/'||u.search||u.hash||
    u.username||u.password||!(u.port===''||integer(Number(u.port),1,65535)))
    return null;
  if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))return null;
  return Object.freeze({host:u.hostname==='[::1]'?'::1':'127.0.0.1',
    port:u.port?Number(u.port):80});
 }catch{return null;}
}
function validateModel(value) {
 if(typeof value!=='string'||!modelPattern.test(value)||
   value.includes('..')||/(:cloud|\/cloud)(?:$|:)/i.test(value))
   refuse('Only a downloaded local Ollama model may be selected');
 return value;
}
function fields(value,known){props(value,known);}
function timeout(value,defaultMs=20000){
 if(value===undefined)return defaultMs;
 if(!integer(value,1000,60000))refuse('Invalid local inference deadline');
 return value;
}
function budget(value) {
 if(value===undefined)return 256;
 if(!integer(value,1,512))refuse('Invalid local token budget');
 return value;
}
function checkedSave(input,roots) {
 if(input.outputFile===undefined) {
  if(input.confirm!==undefined||input.root!==undefined)refuse();
  return null;
 }
 if(!textBytes(input.outputFile,1024)||!input.outputFile)refuse();
 if(input.confirm!==true||!integer(input.root??0,0,roots.length-1))refuse();
 return {root:input.root??0,path:input.outputFile};
}
/**
 * Fixed-route HTTP client, single request only. 3xx and every unexpected
 * status are errors, never followed. No cookies, bearer or ambient credential
 * header, and no output returned on malformed/oversized JSON.
 */
export async function requestLocalOllama(base,endpoint,payload=null,ms=20000,
 {request=httpRequest}={}){
 if(!base||!allowedEndpoints.has(endpoint)||!integer(ms,1000,60000)||
   payload!==null&&!plain(payload))refuse();
 const method=payload===null?'GET':'POST';
 const json=payload===null?null:JSON.stringify(payload);
 if(json!==null&&Buffer.byteLength(json,'utf8')>12500)refuse('Local model request too large');
 return new Promise((resolve,reject)=>{
  let done=false,req;
  const fail=()=>{if(!done){done=true;reject(new ToolError(
    'Local Ollama unavailable, slow or invalid; no remote fallback',-32602));}};
  try {
   req=request({host:base.host,port:base.port,path:endpoint,
    method,agent:false,timeout:ms,
    headers:{Accept:'application/json',
      ...(json===null?{}:{'Content-Type':'application/json',
        'Content-Length':Buffer.byteLength(json,'utf8')})}},res=>{
    if(res.statusCode!==200||
      !/^application\/json(?:\s*;|$)/i.test(String(res.headers['content-type']||''))) {
      res.resume();return fail();
    }
    const chunks=[];let size=0;
    res.on('data',b=>{
     if(done)return;
     size+=b.length;
     if(size>MAX_REPLY){fail();req.destroy();return;}
     chunks.push(b);
    });
    res.on('error',fail);
    res.on('end',()=>{
     if(done)return;
     try{
      const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(
       Buffer.concat(chunks)));
      if(!plain(value))return fail();
      done=true;resolve(value);
     }catch{fail();}
    });
   });
   req.setTimeout(ms,()=>{fail();req.destroy();});
   req.on('error',fail);
   req.end(json??undefined);
  }catch{fail();}
 });
}
function downloaded(data){
 if(!Array.isArray(data?.models)||data.models.length>500)refuse();
 const models=[];
 for(const row of data.models){
  if(!plain(row)||!modelPattern.test(row.name||''))continue;
  if(!integer(row.size,1,Number.MAX_SAFE_INTEGER)||
    !/^[a-fA-F0-9]{64}$/.test(row.digest||''))continue;
  if(/(:cloud|\/cloud)(?:$|:)/i.test(row.name))continue;
  models.push({name:row.name,digest:row.digest,size:row.size});
 }
 return models;
}
async function requireDownloaded(base,name,request){
 const items=downloaded(await request(base,'/api/tags',null,5000));
 const wanted=validateModel(name);
 const model=items.find(x=>x.name===wanted||
   (!wanted.includes(':')&&x.name===wanted+':latest'));
 if(!model)refuse('Selected model is not installed locally; no automatic pull or cloud call');
 return model.name;
}
function metrics(response) {
 const out={};
 for(const key of ['prompt_eval_count','eval_count','total_duration']){
  const value=response[key];
  if(integer(value,0,Number.MAX_SAFE_INTEGER))out[key]=value;
 }
 return out;
}
async function captureOrReturn(text,opts,roots,{store=createConfirmedLocalFile}={}){
 if(!textBytes(text,MAX_TEXT))refuse('Local model output exceeds bounded capture');
 if(!opts){
  if(Buffer.byteLength(text,'utf8')>MAX_INLINE)
   refuse('Complete response is too large; request confirmed outputFile');
  return {content:text,stored:false,bytes:Buffer.byteLength(text,'utf8')};
 }
 const saved=await store(roots,{root:opts.root,path:opts.path,
  content:text,confirm:true});
 return {stored:true,path:saved.path,root:saved.root,bytes:saved.bytes};
}
export async function invokeLocalOllama(name,roots,args={},{
 env=process.env,request=requestLocalOllama,store=createConfirmedLocalFile}={}){
 const base=configuredLocalOllama(env);
 if(!base)refuse('Local Ollama is not configured on this machine');
 if(!LOCAL_OLLAMA_TOOLS.some(x=>x.name===name))refuse();
 if(name==='local.ollama_status'){
  fields(args,[]);
  const data=await request(base,'/api/version',null,2000);
  if(!textBytes(data.version,80)||!data.version)refuse();
  return {available:true,version:data.version,localOnly:true};
 }
 if(name==='local.ollama_models'||name==='local.ollama_running'){
  fields(args,[]);
  const data=await request(base,name.endsWith('_models')?'/api/tags':'/api/ps',
   null,5000);
  const models=downloaded(data);
  return {models:models.slice(0,64),hasMore:models.length>64,localOnly:true};
 }
 const known=['model','prompt','messages','input','timeoutMs','numPredict',
  'outputFile','root','confirm'];
 fields(args,known);
 const save=checkedSave(args,roots);
 const model=await requireDownloaded(base,args.model,request);
 const ms=timeout(args.timeoutMs);
 if(name==='local.ollama_generate'){
  if(!textBytes(args.prompt,MAX_PROMPT)||!args.prompt)refuse();
  if(args.messages!==undefined||args.input!==undefined)refuse();
  const data=await request(base,'/api/generate',{
   model,prompt:args.prompt,stream:false,options:{num_predict:budget(args.numPredict)}
  },ms);
  if(data.done!==true||typeof data.response!=='string')refuse();
  return {model,...(await captureOrReturn(data.response,save,roots,{store})),
   ...metrics(data),localOnly:true};
 }
 if(name==='local.ollama_chat'){
  if(args.prompt!==undefined||args.input!==undefined||!Array.isArray(args.messages)||
   args.messages.length<1||args.messages.length>10)refuse();
  const messages=args.messages.map(message=>{
   fields(message,['role','content']);
   if(!['system','user','assistant'].includes(message.role)||
      !textBytes(message.content,2048))refuse();
   return {role:message.role,content:message.content};
  });
  if(Buffer.byteLength(JSON.stringify(messages),'utf8')>8192)refuse();
  const data=await request(base,'/api/chat',{
   model,messages,stream:false,options:{num_predict:budget(args.numPredict)}
  },ms);
  if(data.done!==true||!plain(data.message)||
    typeof data.message.content!=='string'||data.message.tool_calls?.length)
    refuse();
  return {model,...(await captureOrReturn(data.message.content,save,roots,{store})),
   ...metrics(data),localOnly:true};
 }
 if(args.prompt!==undefined||args.messages!==undefined||args.numPredict!==undefined||
   !textBytes(args.input,MAX_PROMPT)||!args.input)refuse();
 const data=await request(base,'/api/embed',{model,input:args.input},ms);
 if(!Array.isArray(data.embeddings)||data.embeddings.length!==1||
   !Array.isArray(data.embeddings[0])||data.embeddings[0].length<1||
   data.embeddings[0].length>4096||
   data.embeddings[0].some(x=>typeof x!=='number'||!Number.isFinite(x)))
   refuse();
 const vector=data.embeddings[0],encoded=JSON.stringify(vector);
 const result=await captureOrReturn(encoded,save,roots,{store});
 return {model,dimensions:vector.length,
  ...(result.stored?result:{embedding:vector,stored:false}),
  ...metrics(data),localOnly:true};
}
