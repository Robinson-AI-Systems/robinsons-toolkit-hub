import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleOwnerGrants} from '../../packages/hub/src/owner-grants.js';
export default function handler(req,res) {
  return handleOwnerGrants(req,res,{withDb:withHubDb});
}
