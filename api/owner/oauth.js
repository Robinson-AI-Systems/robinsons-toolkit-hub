import {withHubDb} from '../../packages/hub/src/runtime.js';
import {handleOwnerOAuth} from '../../packages/hub/src/owner-oauth.js';

export default function handler(req,res) {
  return handleOwnerOAuth(req,res,{withDb:withHubDb});
}
