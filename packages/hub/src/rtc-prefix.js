// RTC manifests may advertise either 'stripe' or an already-delimited
// 'workspace_' prefix. Accept precisely one canonical separator and a
// nonempty member, without ever treating a nested prefix as a wildcard.
const prefixPattern=/^[a-z][a-z0-9_]{1,59}$/;
const toolPattern=/^[a-z][a-z0-9_]{2,119}$/;
export function ownsRtcToolName(prefix,name) {
  if(typeof prefix!=='string'||!prefixPattern.test(prefix)||
    typeof name!=='string'||!toolPattern.test(name)) return false;
  const base=prefix.endsWith('_')?prefix:prefix+'_';
  if(!name.startsWith(base))return false;
  const member=name.slice(base.length);
  return /^[a-z][a-z0-9_]*$/.test(member);
}
