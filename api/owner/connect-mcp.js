import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleOwnerConnectMcp} from '../../packages/hub/src/owner-connect-mcp.js';
export default (req,res)=>handleOwnerConnectMcp(req,res,{withDb:withHubDb});
