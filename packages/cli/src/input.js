// Read a pass with no terminal echo. Never log, write or interpolate the value.
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { RouteError } from './config.js';

export async function readHiddenPass({ input = process.stdin, error = process.stderr } = {}) {
  const silent = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const terminal = Boolean(input.isTTY);
  const rl = createInterface({ input, output: silent, terminal, historySize: 0 });
  try {
    error.write('Enter RTC server pass (input hidden): ');
    const pass = (await rl.question('')).trim();
    error.write('\n');
    if (!/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(pass))
      throw new RouteError('Pass must match RTC 1 format; no credential saved');
    return pass;
  } finally {
    rl.close();
    silent.end();
  }
}
