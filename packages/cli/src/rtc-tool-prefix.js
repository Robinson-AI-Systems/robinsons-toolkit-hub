// RTC manifests use provider-chosen prefixes: some, such as workspace_,
// already contain a trailing delimiter. Require exactly one boundary.
// This is only a namespace preflight, never tool authorization.
export function belongsToRtcNamespace(prefix, tool) {
  if (typeof prefix !== 'string' || !/^[a-z][a-z0-9_]*$/.test(prefix) ||
      typeof tool !== 'string' || !/^[a-z][a-z0-9_]*$/.test(tool)) return false;
  const stem = prefix.endsWith('_') ? prefix : prefix + '_';
  return tool.length > stem.length && tool.startsWith(stem) &&
    /^[a-z][a-z0-9_]*$/.test(tool.slice(stem.length));
}
