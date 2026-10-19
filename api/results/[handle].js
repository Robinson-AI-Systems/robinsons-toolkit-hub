import {withHubDb,hubActor} from '../../packages/hub/src/runtime.js';
import {handleHubResult} from '../../packages/hub/src/results-http.js';
export default function handler(req,res) {
 return handleHubResult(req,res,{withDb:withHubDb,authorize:hubActor});
}
