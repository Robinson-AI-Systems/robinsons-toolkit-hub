// Managed agent instructions never include secret values or overwrite unrelated work.
import { lstat, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { displayServers } from './config.js';
import { ToolError } from './http.js';
const BEGIN = '<!-- RTOOL:BEGIN -->';
const END = '<!-- RTOOL:END -->';
export const SKILL = [
  '# Robinson Toolkit',
  'Use rtool with standalone RTC servers; the hub is not required.',
  'Never paste a pass into a prompt, source file, or command argument.',
  'Run rtool servers, tools, describe, and call to discover actual tools.',
  'Preview changing operations with --dry-run; --confirm does not bypass server guards.',
  'Use --out NEW_FILE for large results. Never claim a call succeeded without read-back.',
  'Direct HTTPS is tried first; owner-configured encrypted GitHub relay is the fallback. Never repeat an ambiguous write.'
].join('\n') + '\n';
export function routeSummary(servers, env = process.env) {
  return displayServers(servers, env).map(({ name, url, passConfigured }) => ({
    name, url, route: 'direct HTTPS (not connectivity tested)',
    authorization: passConfigured ? 'pass supplied, not verified' : 'no pass configured',
    relay: env.RTOOL_RELAY ? 'configured, not connectivity tested' : 'not configured'
  }));
}
function section(servers, env) {
  return [BEGIN, '### Robinson Toolkit (RTC / rtool)', '',
    'Discover only real tools: rtool servers; rtool tools ALIAS; rtool describe ALIAS.TOOL.',
    'To call: rtool call ALIAS.TOOL --args JSON; for writes use --dry-run first.',
    'Never include passes in this file. The remote server enforces confirmation.',
    'Use owner-configured relay routes only; never store passes or tokens here.', '',
    ...routeSummary(servers, env).map((x) => '- ' + x.name + ': ' +
      x.route + ', ' + x.authorization),
    END].join('\n');
}
export function reconcileAgentText(current, patch) {
  const start = current.indexOf(BEGIN);
  const end = current.indexOf(END);
  if (start === -1 && end === -1) return current.trimEnd() + '\n\n' + patch + '\n';
  if (start < 0 || end < start || end < start ||
    current.indexOf(BEGIN, start + BEGIN.length) >= 0 ||
    current.indexOf(END, end + END.length) >= 0)
    throw new ToolError('Malformed managed section; refusing to edit instructions');
  return current.slice(0, start) + patch + current.slice(end + END.length);
}
export async function writeAgentSetup({ dir = process.cwd(), servers, env = process.env } = {}) {
  const target = resolve(dir, 'AGENTS.md');
  let original = '';
  try {
    const st = await lstat(target);
    if (!st.isFile() || st.isSymbolicLink()) throw new ToolError('Refusing unsafe AGENTS.md');
    original = await readFile(target, 'utf8');
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const next = reconcileAgentText(original, section(servers, env));
  if (next === original) return { target, changed: false };
  const temp = target + '.rtool-' + process.pid;
  try {
    await writeFile(temp, next, { mode: 0o600, flag: 'wx' });
    await rename(temp, target);
  } catch (e) { await rm(temp, { force: true }); throw e; }
  return { target, changed: true };
}
export async function writeSkill({ dir = process.cwd() } = {}) {
  const folder = resolve(dir, '.agents', 'skills', 'rtool');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const target = join(folder, 'SKILL.md');
  await writeFile(target, SKILL, { mode: 0o600, flag: 'wx' });
  return target;
}
