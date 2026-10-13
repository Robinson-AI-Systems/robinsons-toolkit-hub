import { handleHubTools } from '../../packages/hub/src/tools-http.js';
import { withHubDb, hubActor } from '../../packages/hub/src/runtime.js';
export default function handler(req, res) {
  return handleHubTools(req, res, { withDb: withHubDb, authorize: hubActor }, 'list');
}
