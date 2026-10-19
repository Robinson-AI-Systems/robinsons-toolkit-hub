import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleOwnerConnectService} from '../../packages/hub/src/owner-connect-service.js';
export default (req,res)=>handleOwnerConnectService(req,res,{withDb:withHubDb});
