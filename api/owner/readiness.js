import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleOwnerReadiness} from '../../packages/hub/src/owner-readiness.js';
export default function handler(req,res) {
 return handleOwnerReadiness(req,res,{withDb:withHubDb});
}
