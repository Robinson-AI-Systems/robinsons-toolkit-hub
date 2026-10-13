import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleOwnerServers} from '../../packages/hub/src/owner-servers.js';
export default function handler(req,res) {
  return handleOwnerServers(req,res,{withDb:withHubDb});
}
