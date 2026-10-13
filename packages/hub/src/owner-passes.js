import { issueHubPass, revokeHubPass } from './identity.js';
import { escapeHtml, formFields, htmlHeaders, publicHubOrigin,
  verifyOwnerLogin } from './owner-login.js';

function page(content) {
  return '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<title>Toolkit Hub owner passes</title><main><h1>Hub connection passes</h1>' +
    '<p>These passes access only the Hub in read-only TEST mode. ' +
    'Upstream service passes must be issued and scoped independently.</p>' +
    content + '</main></html>';
}
function passForm() {
  return page('<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="issue">' +
    '<label>Owner passphrase <input type="password" name="password" ' +
    'autocomplete="current-password" required></label>' +
    '<button type="submit">Create one-day read-only TEST pass</button></form>' +
    '<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="revoke">' +
    '<label>Pass identifier <input name="id" maxlength="36" required></label>' +
    '<label>Owner passphrase <input type="password" name="password" ' +
    'autocomplete="current-password" required></label>' +
    '<button type="submit">Revoke pass now</button></form>');
}
function passDisplay(result) {
  return page('<h2>One-time connection pass</h2>' +
    '<p>Copy this directly into your secure client credential manager. ' +
    'It will never be shown again. Do not put it in chat, tickets or logs.</p>' +
    '<label>Pass <textarea rows="2" cols="80" readonly>' +
    escapeHtml(result.pass) + '</textarea></label>' +
    '<p>Identifier for revocation: <code>' + escapeHtml(result.id) + '</code></p>');
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// An independently verified owner is the only issuer. No bearer, OAuth
// session, caller argument, provider service or AI can mint or broaden passes.
export async function handleOwnerPasses(req, res, { withDb, env = process.env,
  verify = verifyOwnerLogin, issue = issueHubPass, revoke = revokeHubPass } = {}) {
  htmlHeaders(res);
  res.setHeader('Pragma', 'no-cache');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Method not allowed');
  }
  try { publicHubOrigin(env); }
  catch { return res.status(503).send('Hub owner setup unavailable'); }
  if (req.method === 'GET') return res.status(200).send(passForm());
  if (!String(req.headers?.['content-type'] || '').startsWith('application/x-www-form-urlencoded'))
    return res.status(415).send('Unsupported content type');
  const fields = formFields(req);
  if (!fields || !['issue', 'revoke'].includes(fields.action) ||
    typeof fields.password !== 'string' || fields.password.length === 0 ||
    (fields.action === 'revoke' && !uuid.test(fields.id || '')))
    return res.status(400).send('Invalid request');
  try {
    return await withDb(async (db, settings) => {
      const decision = await verify(db, req, fields.password, { env });
      if (!decision.approved) {
        if (decision.retryAfter) res.setHeader('Retry-After', String(decision.retryAfter));
        return res.status(decision.retryAfter ? 429 : 401).send('Owner verification denied');
      }
      if (fields.action === 'revoke') {
        const revoked = await revoke(db, fields.id, env.HUB_OWNER_ID,
          { ownerVerified: true });
        return res.status(revoked ? 200 : 404).send(revoked ?
          'Hub pass revoked.' : 'Pass not found or already revoked.');
      }
      const issued = await issue(db, {
        ownerId: env.HUB_OWNER_ID,
        profile: 'read_only',
        mode: 'test',
        areas: ['gateway'],
        allowWrites: false,
        ttlSeconds: 86400
      }, { ownerVerified: true, pepper: settings.pepper });
      return res.status(201).send(passDisplay(issued));
    });
  } catch {
    return res.status(503).send('Hub owner pass setup unavailable');
  }
}
