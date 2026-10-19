import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleOwnerMcpCallback} from '../../packages/hub/src/owner-connect-mcp.js';
export default (req,res)=>handleOwnerMcpCallback(req,res,{withDb:withHubDb});
