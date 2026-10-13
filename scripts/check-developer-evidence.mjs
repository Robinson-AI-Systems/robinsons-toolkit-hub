// Evidence admissibility guard; this validates provenance, never manufactures runtime proof.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function validateEvidence(document){
 const errors=[];
 if(document?.version!==1||typeof document.repository!=='string'||typeof document.service!=='string'||!Array.isArray(document.records))return ['Invalid developer evidence document'];
 const layers=new Set(['source','automated','deployed','custom_transport','provider','hub','revocation','cleanup']);
 const counts=new Map();for(const row of document.records)counts.set(row?.layer,(counts.get(row?.layer)||0)+1);
 for(const layer of layers)if(counts.get(layer)!==1)errors.push('Every evidence layer must occur exactly once: '+layer);
 const external=new Set(['deployed','custom_transport','provider','hub','revocation','cleanup']);
 for(const row of document.records){
  if(!row||!layers.has(row.layer)||!['verified','unverified','failed','blocked'].includes(row.status)){errors.push('Unknown evidence layer or status');continue;}
  if(row.status!=='verified')continue;
  if(row.layer==='source'&&!['repository_source'].includes(row.source))errors.push('Source proof must come from repository source');
  if(row.layer==='automated'&&!['local_tests','github_actions'].includes(row.source))errors.push('Automated proof needs actual test evidence');
  if(external.has(row.layer)){
   if((row.layer==='deployed'?row.source!=='deployment_provider':row.source!=='custom_service')||row.service!==document.service)errors.push('Standard connectors, reference servers and other services cannot prove this custom MCP');
   if(!/^[a-f0-9]{40}$/.test(row.commit||''))errors.push('External proof needs exact deployed commit');
   try{const u=new URL(row.origin);if(u.protocol!=='https:'||u.origin!==row.origin||u.username||u.password)throw Error();}catch{errors.push('External proof needs a canonical HTTPS origin');}
   if(!(row.layer==='deployed'?['deployment_api']:['native_mcp','rtc_direct','rtc_relay','rtc_sandbox']).includes(row.transport))errors.push('External proof needs an actual custom-service transport');
   if(!Array.isArray(row.observations)||!row.observations.length||row.observations.some(x=>typeof x!=='string'||!x.trim()))errors.push('External proof needs concrete observations');
   if(row.layer==='provider'&&['permitted_read','permitted_write','denied_resource_access','denied_identity_access','provider_readback'].some(x=>!row.observations.includes(x)))errors.push('Provider acceptance needs permitted read/write, resource/identity denial and provider readback');
   if(row.layer==='hub'&&(!['rtc_direct','rtc_relay','rtc_sandbox'].includes(row.transport)||!row.observations.includes('hub_route_readback')))errors.push('Hub acceptance needs an actual Hub-mediated RTC route and readback');
   if(row.layer==='revocation'&&!row.observations.includes('same_credential_revoked_denial'))errors.push('A generic denial is not revocation proof');
  }
 }
 // Standalone observations document partial client checks, never close hosted Hub layers.
 if(document.upstream_observations!==undefined&&!Array.isArray(document.upstream_observations))errors.push('Upstream observations must be an array');
 for(const row of Array.isArray(document.upstream_observations)?document.upstream_observations:[]){
  if(!row||row.status!=='partial'||row.source!=='custom_service'||row.transport!=='native_mcp'||row.closes_hosted_hub_layers!==false||row.full_provider_acceptance!==false){errors.push('Partial upstream checks cannot certify hosted Hub or full provider acceptance');continue;}
  if(typeof row.service!=='string'||row.service===document.service||!/^Robinson-AI-Systems\/[a-z0-9-]+$/.test(row.repository||''))errors.push('Upstream checks must identify a separate custom service repository');
  if(!/^[a-f0-9]{40}$/.test(row.commit||'')||!/^[a-f0-9]{40}$/.test(row.client_commit||''))errors.push('Upstream checks require exact server and client revisions');
  try{const u=new URL(row.origin);if(u.protocol!=='https:'||u.origin!==row.origin||u.username||u.password)throw Error();}catch{errors.push('Upstream checks need a canonical HTTPS origin');}
  if(!Array.isArray(row.observations)||!row.observations.length||row.observations.some(x=>typeof x!=='string'||!x.trim()))errors.push('Upstream checks need concrete observations');
 }
 return errors;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const document=JSON.parse(readFileSync(new URL('../docs/developer-evidence.json',import.meta.url),'utf8'));
  const errors=validateEvidence(document);if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Developer evidence provenance valid; unverified layers remain unverified.');
 }catch{console.error('Developer evidence file is missing or invalid');process.exitCode=1;}
}
