// Native OS keyrings; secrets are never passed on argv, environment or disk by rtool.
// Linux: Secret Service via secret-tool; macOS: Keychain via security;
// Windows: Windows Credential Manager via CredRead/CredWrite/CredDelete P/Invoke.
import {randomBytes} from 'node:crypto';
import { spawn } from 'node:child_process';
import { RouteError } from './config.js';
import {validDeveloperCredential} from './developer-client.js';

const SERVICE = 'robinsons-toolkit-rtool';
const ALIAS = /^[a-z][a-z0-9_-]{0,39}$/;
const allowedEnv = ['PATH', 'HOME', 'USER', 'USERPROFILE', 'SYSTEMROOT', 'WINDIR',
  'TMP', 'TEMP', 'LANG', 'LC_ALL', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS'];
const safeEnvironment = (env) => Object.fromEntries(
  allowedEnv.filter((key) => typeof env[key] === 'string').map((key) => [key, env[key]]));
const winScript = String.raw`
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class RtoolCredential {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct Cred {
    public UInt32 Flags, Type;
    public string TargetName, Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 BlobSize;
    public IntPtr Blob;
    public UInt32 Persist, AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias, UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredWriteW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool Write(ref Cred credential, uint flags);
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool Read(string target, uint type, uint flags, out IntPtr pointer);
  [DllImport("advapi32.dll", EntryPoint="CredDeleteW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool Delete(string target, uint type, uint flags);
  [DllImport("advapi32.dll", EntryPoint="CredFree")]
  static extern void Free(IntPtr pointer);
  public static bool Save(string name, string value) {
    byte[] bytes = Encoding.Unicode.GetBytes(value);
    IntPtr blob = Marshal.AllocHGlobal(bytes.Length);
    try {
      Marshal.Copy(bytes, 0, blob, bytes.Length);
      var cred = new Cred { Type = 1, TargetName = name, UserName = "rtool",
        Blob = blob, BlobSize = (uint)bytes.Length, Persist = 2 };
      return Write(ref cred, 0);
    } finally {
      Marshal.Copy(new byte[bytes.Length], 0, blob, bytes.Length);
      Marshal.FreeHGlobal(blob);
      Array.Clear(bytes, 0, bytes.Length);
    }
  }
  public static string Load(string name) {
    IntPtr ptr;
    if (!Read(name, 1, 0, out ptr)) return null;
    try {
      var cred = (Cred)Marshal.PtrToStructure(ptr, typeof(Cred));
      return Marshal.PtrToStringUni(cred.Blob, (int)(cred.BlobSize / 2));
    } finally { Free(ptr); }
  }
  public static bool Remove(string name) { return Delete(name, 1, 0); }
}
'@
$target = $env:RTOOL_KEYRING_TARGET
$action = $env:RTOOL_KEYRING_ACTION
if ($action -eq 'store') {
  $pass = [Console]::In.ReadLine()
  if (-not [RtoolCredential]::Save($target, $pass)) { exit 1 }
} elseif ($action -eq 'lookup') {
  $pass = [RtoolCredential]::Load($target)
  if ($null -eq $pass) { exit 3 }
  [Console]::Out.Write($pass)
} elseif ($action -eq 'delete') {
  if (-not [RtoolCredential]::Remove($target)) { exit 3 }
} else { exit 2 }
`;
export function nativePlan({ action, name, platform = process.platform, env = process.env, kind = 'pass', slot = '' } = {}) {
  if (!['pass','oauth'].includes(kind))throw new RouteError('Invalid credential kind');
  if (!ALIAS.test(name || '') || !['store', 'lookup', 'delete'].includes(action)) {
    throw new RouteError('Invalid keychain service name or operation');
  }
  if(slot && (kind!=='oauth'||!/^part-[a-f0-9]{16}-[0-9]{1,2}$/.test(slot)))throw new RouteError('Invalid credential slot');
  const common = safeEnvironment(env);
  const service=kind==='oauth'?SERVICE+'-developer-oauth'+(slot?'-'+slot:''):SERVICE;
  const target = service + ':' + name;
  if (platform === 'linux') {
    const command = 'secret-tool';
    const args = action === 'store' ?
      ['store', '--label=Robinson Toolkit rtool', 'service', service, 'account', name] :
      [action === 'lookup' ? 'lookup' : 'clear', 'service', service, 'account', name];
    return { command, args, env: common };
  }
  if (platform === 'darwin') {
    const args = action === 'store'
      ? ['add-generic-password', '-U', '-s', target, '-a', 'rtool', '-w']
      : action === 'lookup'
        ? ['find-generic-password', '-s', target, '-a', 'rtool', '-w']
        : ['delete-generic-password', '-s', target, '-a', 'rtool'];
    return { command: 'security', args, env: common };
  }
  if (platform === 'win32') {
    // The encoded PowerShell command contains only static P/Invoke code.
    // The pass is delivered separately through stdin, never interpolated into script.
    return { command: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-EncodedCommand',
      Buffer.from(winScript, 'utf16le').toString('base64')],
      env: { ...common, RTOOL_KEYRING_TARGET: target, RTOOL_KEYRING_ACTION: action } };
  }
  throw new RouteError('No supported OS keychain on this operating system');
}
export async function runNative(plan, input = '', spawnFn = spawn) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnFn(plan.command, plan.args, { env: plan.env, stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true });
    } catch { reject(new RouteError('OS credential manager not available')); return; }
    let stdout = '', stderrLength = 0, ended = false;
    const timeout = setTimeout(() => child.kill(), 15000);
    child.once('error', () => { clearTimeout(timeout); reject(new RouteError('OS credential manager unavailable')); });
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > 8192) child.kill();
    });
    child.stderr.on('data', (chunk) => {
      stderrLength += chunk.length;
      if (stderrLength > 8192) child.kill();
    });
    child.once('close', (code) => {
      if (ended) return;
      ended = true;
      clearTimeout(timeout);
      // Do not emit stderr or command lines: these may contain sensitive data.
      if (code === 0) resolve({ found: true, value: stdout.replace(/\r?\n$/, '') });
      else if (code === 3 || (code === 1 && plan.command !== 'powershell.exe' && !stdout))
        resolve({ found: false, value: null });
      else reject(new RouteError('OS credential manager denied the operation'));
    });
    // A newline separates the payload from the shell's stdin; never add it to argv.
    child.stdin.end(input ? input + '\n' : '');
  });
}
export function makeKeychain({ platform = process.platform, env = process.env,
  run = runNative } = {}) {
  const execute = async (action, name, value, kind='pass',slot='') => {
    const plan = nativePlan({ action, name, platform, env, kind,slot });
    return run(plan, value || '');
  };
  async function removeParts(name,result){
   if(platform!=='win32'||!result.found)return;
   let old;try{old=JSON.parse(result.value);}catch{return;}
   if(old.format!=='oauth-chunks'||!/^([a-f0-9]{16})$/.test(old.id)||!Number.isInteger(old.count)||old.count<1||old.count>32)return;
   for(let i=0;i<old.count;i++)await execute('delete',name,null,'oauth','part-'+old.id+'-'+i).catch(()=>{});
  }
  return {
    async getOAuth(name){
      const result=await execute('lookup',name,null,'oauth');
      if(!result.found)return null;
      let value;try{
       value=JSON.parse(result.value);
       if(value.format==='oauth-chunks'){
        if(platform!=='win32'||!/^([a-f0-9]{16})$/.test(value.id)||!Number.isInteger(value.count)||value.count<1||value.count>32)throw Error();
        let text='';for(let i=0;i<value.count;i++){
         const part=await execute('lookup',name,null,'oauth','part-'+value.id+'-'+i);
         if(!part.found)throw Error();text+=part.value;
        }
        value=JSON.parse(text);
       }
      }catch{throw new RouteError('Invalid stored developer credential');}
      if(!validDeveloperCredential(value))throw new RouteError('Invalid stored developer credential');
      return value;
    },
    async setOAuth(name,value){
      if(!validDeveloperCredential(value))throw new RouteError('Invalid developer credential; nothing stored');
      const text=JSON.stringify(value);
      if(platform!=='win32'){
       const result=await execute('store',name,text,'oauth');
       if(!result.found)throw new RouteError('OS keychain refused developer credential');return;
      }
      const old=await execute('lookup',name,null,'oauth');
      const id=randomBytes(8).toString('hex'),count=Math.ceil(text.length/1000);
      if(count>32)throw new RouteError('Developer credential exceeds OS vault capacity');
      const slots=[];
      try{
       for(let i=0;i<count;i++){
        const slot='part-'+id+'-'+i;slots.push(slot);
        if(!(await execute('store',name,text.slice(i*1000,(i+1)*1000),'oauth',slot)).found)throw new RouteError('OS keychain refused developer credential');
       }
       if(!(await execute('store',name,JSON.stringify({format:'oauth-chunks',id,count}),'oauth')).found)throw new RouteError('OS keychain refused developer credential');
      }catch(e){for(const slot of slots)await execute('delete',name,null,'oauth',slot).catch(()=>{});throw e;}
      await removeParts(name,old);
    },
    async deleteOAuth(name){
      const old=await execute('lookup',name,null,'oauth');
      const removed=(await execute('delete',name,null,'oauth')).found;
      if(removed)await removeParts(name,old);return removed;
    },
    async get(name) {
      const result = await execute('lookup', name);
      return result.found ? result.value : null;
    },
    async set(name, pass) {
      if (!/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(pass || ''))
        throw new RouteError('Pass format must match RTC 1; no credential stored');
      const result = await execute('store', name, pass);
      if (!result.found) throw new RouteError('OS keychain refused to save pass');
    },
    async delete(name) {
      const result = await execute('delete', name);
      return result.found;
    }
  };
}
export async function addStoredPasses(servers, env, keychain) {
  const enriched = { ...env };
  for (const [name] of servers) {
    const key = 'RTOOL_PASS_' + name.toUpperCase().replaceAll('-', '_');
    if (enriched[key]) continue;
    try {
      const value = await keychain.get(name);
      if (value) enriched[key] = value;
    } catch {
      // Missing keychain authorization must not block unrelated configured servers.
    }
  }
  return enriched;
}
