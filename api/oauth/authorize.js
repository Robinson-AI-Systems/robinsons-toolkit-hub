import { withHubDb } from '../../packages/hub/src/runtime.js';
import {developerConsent} from '../../packages/hub/src/developer-handoff.js';
import { authorizeOwnerConnection, formFields, htmlForm, htmlHeaders,
  publicHubOrigin } from '../../packages/hub/src/owner-login.js';
export default async function handler(req,res) {
  htmlHeaders(res);
  if (!['GET','POST'].includes(req.method)) return res.status(405).send('Method not allowed');
  const fields=formFields(req);
  if (!fields) return res.status(400).send('Invalid request');
  try {
    publicHubOrigin();
    return await withHubDb(async db=>{
      const result=await developerConsent(db,req,fields) || await authorizeOwnerConnection(db,req,fields);
      if (result.status===200)
        return res.status(200).send(htmlForm('/api/oauth/authorize',result.fields));
      if (result.status===303) {
        res.setHeader('Location',result.redirect);
        return res.status(303).end();
      }
      if (result.retryAfter) res.setHeader('Retry-After',String(result.retryAfter));
      return res.status(result.status).send('Authorization denied');
    });
  } catch { return res.status(503).send('Owner authorization unavailable'); }
}
