import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleVerifyGrant} from '../../packages/hub/src/owner-verify-grant.js';
export default function handler(req,res) {
  return handleVerifyGrant(req,res,{withDb:withHubDb});
}
