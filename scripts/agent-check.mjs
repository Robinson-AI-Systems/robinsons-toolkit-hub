#!/usr/bin/env node
import { checkAgent, parseAgentCheck } from '../packages/cli/src/agent-check.js';
try { process.exitCode = await checkAgent(parseAgentCheck(process.argv.slice(2))); }
catch {
  process.stderr.write('Usage: node scripts/agent-check.mjs --server ALIAS --read-tool TOOL --pass-env ENV_NAME [--args-env ENV_NAME] [--expect-route direct|relay|auto] [--authorized-real-run]\n');
  process.exitCode = 2;
}
