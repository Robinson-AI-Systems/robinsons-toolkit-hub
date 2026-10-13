import { withHubDb } from '../../packages/hub/src/runtime.js';
import { handleOwnerConnections } from '../../packages/hub/src/owner-connections.js';
export default function handler(req,res) {
  return handleOwnerConnections(req,res,{withDb:withHubDb});
}
