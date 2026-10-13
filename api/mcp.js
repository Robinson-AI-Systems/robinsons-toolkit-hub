import { handleMcp } from '../packages/hub/src/http-door.js';
import { withHubDb, hubActor } from '../packages/hub/src/runtime.js';
export default async function handler(req,res) {
  return handleMcp(req,res,{withDb:withHubDb,authorize:hubActor});
}
