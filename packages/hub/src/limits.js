import { createHmac } from 'node:crypto';

// One atomic SQL increment across all Node/serverless instances; bucket not
// reset by a cold instance. Bound the requested budgets at call sites.
export async function takeBudget(db, { scope, pepper, now = Date.now(), max = 120, seconds = 60 }) {
  if (typeof scope !== 'string' || !scope || typeof pepper !== 'string' || pepper.length < 32)
    throw new TypeError('Missing request rate-limit identity');
  if (!Number.isSafeInteger(now) || !Number.isInteger(max) || max < 1 || max > 1000 ||
    !Number.isInteger(seconds) || seconds < 1 || seconds > 3600)
    throw new TypeError('Invalid rate-limit budget');
  const digest = createHmac('sha256',pepper).update(scope).digest('hex');
  const bucket = Math.floor(now / (seconds * 1000));
  const { rows } = await db.query(`INSERT INTO hub_request_limits(scope_digest,bucket,hits)
    VALUES($1,$2,1) ON CONFLICT(scope_digest,bucket)
    DO UPDATE SET hits=hub_request_limits.hits+1 RETURNING hits`,[digest,bucket]);
  return { allowed: rows[0].hits <= max, retryAfter: rows[0].hits <= max ? 0 :
    seconds - Math.floor((now % (seconds * 1000)) / 1000) };
}
export async function appendAudit(db, record) {
  const { callerId, grantId = null, service = null, tool = null,
    action, outcome, upstreamLogId = null } = record || {};
  if (!callerId || !/^[a-z_]{2,40}$/.test(action || '') ||
    !/^[a-z_]{2,80}$/.test(outcome || ''))
    throw new TypeError('Invalid audit action');
  const { rows } = await db.query(`INSERT INTO hub_forward_audit
    (caller_id,grant_id,service,tool,action,outcome,upstream_log_id)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
  [callerId,grantId,service,tool,action,outcome,upstreamLogId]);
  return rows[0].id;
}
