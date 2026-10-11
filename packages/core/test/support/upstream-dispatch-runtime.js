// Test-only service injection fixtures around the unmodified original Stripe
// dispatchReadOnlyTool implementation. This does not claim the Stripe SDK,
// live account policy or production redactors are portable.
import { randomBytes } from 'node:crypto';
export const isGuardedTestWrite = (tool, connection) => tool?.writes === true &&
  tool?.guardedTest === true && connection?.mode === 'test' && connection?.profile === 'full';
export const isToolAllowed = (tool, profile, { allowWrites = false } = {}) =>
  Boolean(tool) && ['read_only','everyday','full'].includes(profile) &&
  (tool.writes !== true || allowWrites);
export const shapeToolResult = value => value;
export const readDetail = value => value;
export const splitResult = value => ({ value, totalBytes: Buffer.byteLength(JSON.stringify(value)) });
export const resultPage = (_body, offset) => ({ offset, status: 'stored' });
export const toStripeToolError = () => null;

export async function dispatchReadOnlyTool({ registry, name, args, connection, db, services={} }) {
  const item = registry.tools.find(t => t.name === name);
  const guardedWrite=isGuardedTestWrite(item,connection);
  if (!isToolAllowed(item,connection?.profile,{allowWrites:guardedWrite})) {
    return {isError:true,content:[{type:'text',text:'Tool unavailable for this connection'}]};
  }
  const handler = registry.handlers[name];
  if (typeof handler !== 'function') {
    return {isError:true,content:[{type:'text',text:'Tool unavailable'}]};
  }
  try {
    const raw=shapeToolResult(await handler(args || {},{connection,connectionId:connection?.resultScope,db,services,registry,
      runRead:(toolName,toolArgs)=>dispatchReadOnlyTool({registry,
        name:toolName,args:toolArgs,connection,db,services})}),
      {mode:connection.mode});
    if(raw?.isError)return raw;
    const requested=args||{};
    // Permission re-probe has its own backwards-compatible "compact" detail.
    // Every other read uses the same opt-in dotted field layer.
    const detail=['summary','full'].includes(requested.detail)?requested.detail:undefined;
    let result=raw;
    if(name!=='stripe_get_result'&&Array.isArray(raw?.content)){
      result={...raw,content:raw.content.map(part=>{
        if(part?.type!=='text'||typeof part.text!=='string')return part;
        let value;try {value=JSON.parse(part.text);} catch {return part;}
        return {...part,text:JSON.stringify(readDetail(value,{detail,
          fields:typeof requested.fields==='string'?requested.fields:undefined}))};
      })};
    }
    if(Buffer.byteLength(JSON.stringify(result),'utf8')<=8192)return result;
    // No fallback that silently clips an oversized provider result. Every
    // persisted byte is already redacted by shapeToolResult above.
    if(!connection?.resultScope||typeof db?.putScopedResult!=='function'||
      !Array.isArray(result?.content)||result.content.some(p=>p?.type!=='text')) {
      return {isError:true,content:[{type:'text',text:
        'Result exceeds 8 KB and cannot be securely stored for this connection.'}]};
    }
    const handle='res_'+randomBytes(18).toString('base64url');
    // Save the redacted JSON value, not the MCP transport wrapper, so owner
    // field selectors on stripe_get_result address actual provider fields.
    let safeValue=result;
    if(result.content.length===1&&result.content[0].type==='text') {
      try{safeValue=JSON.parse(result.content[0].text);}catch{/* save shaped wrapper */}
    }
    const body=splitResult(safeValue);
    let records=0;
    try{
      const value=safeValue;
      records=Array.isArray(value)?value.length:
        Array.isArray(value?.data)?value.data.length:
          Array.isArray(value?.accounts)?value.accounts.length:1;
    }catch{records=1;}
    const summary='Saved '+records+' result record(s) from '+name+
      ', '+body.totalBytes+' bytes (TEST connection only)';
    await db.putScopedResult({handle,connection:connection.resultScope,
      body,summary,expiresAt:new Date(Date.now()+86400000)});
    return {content:[{type:'text',text:JSON.stringify({
      handle,summary,totalBytes:body.totalBytes,records,expiresInHours:24,
      ...resultPage(body,0)
    })}]};
  }
  catch (error) {
    return toStripeToolError(error,{mode:connection.mode}) ||
      {isError:true,content:[{type:'text',text:'Could not read account details; check server setup'}]};
  }
}
