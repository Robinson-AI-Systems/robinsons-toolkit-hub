import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleOwnerDashboard} from '../../packages/hub/src/owner-dashboard.js';
export default function handler(req,res){
 return handleOwnerDashboard(req,res,{withDb:withHubDb});
}
