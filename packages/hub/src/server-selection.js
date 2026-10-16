import {serverNamePattern} from './server-name.js';
// A Hub pass may select a strict subset of existing owner-registered RTC servers.
// Null is the pre-H-4 legacy policy: exact caller-owned, verified upstream grants
// continue to be the only route; new owner-form passes must select names explicitly.
const name = serverNamePattern;
const MAX = 20;
export function serverSelection(value, {required = false} = {}) {
  if (value === undefined || value === null) {
    if (required) throw new TypeError('An explicit RTC server selection is required');
    return null;
  }
  if (!Array.isArray(value) || value.length > MAX || (required && !value.length) ||
      value.some(x => typeof x !== 'string' || !name.test(x)) ||
      new Set(value).size !== value.length)
    throw new TypeError('Invalid narrowed RTC server selection');
  return Object.freeze([...value]);
}
export function parseOwnerServerSelection(value) {
  if (typeof value !== 'string' || value.length > 1300 || !value.trim()) return null;
  try {
    return serverSelection(value.split(',').map(x => x.trim()), {required: true});
  } catch { return null; }
}
export function allowedByHubPass(actor, serverName) {
  return !Array.isArray(actor?.serverNames) ||
    (name.test(serverName || '') && actor.serverNames.includes(serverName));
}
