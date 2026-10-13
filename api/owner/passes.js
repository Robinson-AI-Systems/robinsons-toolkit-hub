import { withHubDb } from '../../packages/hub/src/runtime.js';
import { handleOwnerPasses } from '../../packages/hub/src/owner-passes.js';
export default function handler(req, res) {
  return handleOwnerPasses(req, res, { withDb: withHubDb });
}
