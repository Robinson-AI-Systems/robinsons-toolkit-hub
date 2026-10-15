import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleOwnerChanges} from '../../packages/hub/src/owner-changes.js';
export default function handler(req,res){
 return handleOwnerChanges(req,res,{withDb:withHubDb});
}
