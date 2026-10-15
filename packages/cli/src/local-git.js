// Read-only local Git inspection; no git-supplied arguments or arbitrary shell.
import { lstat, realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ToolError } from './http.js';

const run = promisify(execFile);
const MAX_OUTPUT = 4096;
const TIMEOUT = 6000;
const readError = () => { throw new ToolError('Local Git inspection refused or failed', -32602); };
export const LOCAL_GIT_TOOLS = Object.freeze([
  { name: 'local.git_status', description: 'Read tracked Git worktree status of one enabled folder (no untracked file discovery).' },
  { name: 'local.git_diff', description: 'Read a capped Git diff statistic without external diff drivers.' },
  { name: 'local.git_log', description: 'Read at most 10 abbreviated commit summaries, without external commands.' }
].map((entry) => Object.freeze({ ...entry,
  inputSchema: { type: 'object', additionalProperties: false,
    properties: { root: { type: 'integer', minimum: 0 } } },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true,
    openWorldHint: false }
})));

export async function runReadOnlyGit(root,commandArgs) {
 if(!Array.isArray(commandArgs)||!commandArgs.length||
   commandArgs.some(arg=>typeof arg!=='string'||arg.length>1100))
  readError();

  const gitDir = join(root, '.git');
  try {
    // Reject external linked worktrees or a symlinked git metadata directory.
    const metadata = await lstat(gitDir);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) readError();
    const canonical = await realpath(gitDir);
    if (!canonical.startsWith(root + sep)) readError();
  } catch { readError(); }
  const args = ['--no-pager', '--no-optional-locks',
    '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null',
    '-c', 'color.ui=false',
    '--git-dir', gitDir, '--work-tree', root, ...commandArgs];
  try {
    const { stdout } = await run('git', args, {
      cwd: root, shell: false, windowsHide: true,
      timeout: TIMEOUT, maxBuffer: MAX_OUTPUT,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH || '',
        SystemRoot: process.env.SystemRoot || '',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
        GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1',
        GIT_PAGER: 'cat'
      }
    });
    if (Buffer.byteLength(stdout, 'utf8') > MAX_OUTPUT) readError();
    return stdout;
  } catch { readError(); }
}
export async function inspectLocalGit(name,root){
 const commands={
   'local.git_status':['status','--short','--untracked-files=no'],
   'local.git_diff':['diff','--no-ext-diff','--no-textconv','--stat','--','.'],
   'local.git_log':['log','--max-count=10','--format=%h %s']
 };
 if(!Object.hasOwn(commands,name))readError();
 return {action:name,root:true,output:await runReadOnlyGit(root,commands[name])};
}
