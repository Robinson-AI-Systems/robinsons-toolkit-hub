// The authenticated connection selects exactly one profile. A caller-supplied
// tool name or tool arguments must never widen the profile's permissions.
export const CONNECTION_PROFILES=Object.freeze(['read_only','everyday','full']);
export function isToolAllowed(tool, profile, {allowWrites=false}={}) {
  return !!tool && typeof tool.name==='string' &&
    CONNECTION_PROFILES.includes(profile) && Array.isArray(tool.profiles) &&
    tool.profiles.includes(profile) && (tool.writes===false ||
      (allowWrites===true && profile!=='read_only' && tool.writes===true));
}
export function visibleTools(registry,profile,options={}) {
  if (!Array.isArray(registry?.tools)) return [];
  return registry.tools.filter(tool=>isToolAllowed(tool,profile,options));
}
export function profileCounts(registry,options={}) {
  return Object.fromEntries(CONNECTION_PROFILES.map(profile=>
    [profile,visibleTools(registry,profile,options).length]));
}

export function publicToolInfo(tool) {
  const {writes:_writes,profiles:_profiles,area:_area,...rest}=tool;
  const schema=rest.inputSchema||{type:'object',properties:{},additionalProperties:false};
  const properties={...schema.properties};
  // Keep legacy specialist shapes unchanged. Generic read tools gain the
  // standard detail and dotted-field controls without hand-editing each tool.
  if(tool.writes===false){
    if(!Object.hasOwn(properties,'detail'))properties.detail={
      type:'string',enum:['summary','full'],description:'Summary by default; full retains all safe fields'};
    if(!Object.hasOwn(properties,'fields'))properties.fields={
      type:'string',maxLength:600,description:'Up to 12 comma-separated dotted field paths'};
  }
  return {...rest,inputSchema:{...schema,properties},
    annotations:{...rest.annotations,readOnlyHint:tool.writes===false,
      destructiveHint:tool.writes===true ? rest.annotations?.destructiveHint!==false : false,
      idempotentHint:tool.writes===false,
      openWorldHint:true}};
}
