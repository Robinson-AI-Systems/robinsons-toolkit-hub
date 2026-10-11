// Metadata contracts are validated on the *registered* tool objects, not
// guessed from dangerous-sounding names. Public user-facing schemas are
// insufficient unless explicit writes and money specs have been declared.
export function validateWriteDeclarations(tools) {
  const failures=[];
  if (!Array.isArray(tools)) return ['Tool registry must provide a tools array'];
  for (const tool of tools) {
    const name=typeof tool?.name==='string' && tool.name ? tool.name : '(unnamed)';
    if (typeof tool?.writes !== 'boolean') {
      failures.push(name+': missing explicit writes: true|false declaration');
      continue;
    }
    const monetary=tool.safety==='$' || tool.moneyOut===true;
    if (monetary && tool.writes!==true) {
      failures.push(name+': money-out safety marker requires writes: true');
    }
    if (tool.writes===true) {
      const props=tool.inputSchema?.properties;
      if (props?.dryRun?.type!=='boolean') failures.push(name+': missing boolean dryRun');
      if (props?.confirm?.type!=='boolean') failures.push(name+': missing boolean confirm');
      if (tool.writeContract!=='defineWrite-v1') {
        failures.push(name+': missing guarded defineWrite-v1 contract');
      }
      if (monetary && tool.moneySpec!=='provider-derived') {
        failures.push(name+': money-out tool missing provider-derived money spec');
      }
    } else if (tool.moneySpec==='provider-derived') {
      failures.push(name+': a read-only tool cannot declare a money write specification');
    }
  }
  return failures;
}
