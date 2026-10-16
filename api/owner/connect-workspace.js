import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleOwnerConnectWorkspace} from '../../packages/hub/src/owner-connect-workspace.js';
export default (req,res)=>handleOwnerConnectWorkspace(req,res,{withDb:withHubDb});
