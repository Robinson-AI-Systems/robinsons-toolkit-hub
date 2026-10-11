// Source-equivalent guarded write lifecycle with required server-owned account and key adapters.
// Independently authenticated money approval and shared limits MUST be supplied by each service.
const reply = (value, isError = false) => ({
  ...(isError ? { isError: true } : {}),
  content: [{ type: 'text', text: JSON.stringify(value) }]
});
const modes = new Set(['test', 'live']); // LIVE additionally requires injected server-only guard.
const profiles = new Set(['everyday', 'full']);

/** All hooks run server-side. The MCP does not expose a write handler until
 * profile, app-ownership and live guards are installed in later cards.
 *
 * prepare(args,ctx,before) -> {previewLine, amountCents, currency, direction} | null
 * beforeApply({ctx,args,before,key,prepared}) -> {accepted, reason?}
 * afterApply({ctx,args,before,key,prepared,status}) -> settlement / audit finalization
 */
export function defineWrite({ name, read, summarize, apply, readAfter, verify, idempotency,
  inverse = () => null, needsConfirm = true, prepare = null, beforeApply = null,
  afterApply = null, targetGuard = null, modeGuard = null, accountOf = null,
  idempotencyPrefix = null, classifyError = () => 'uncertain' }) {
  if (!/^[a-z][a-z0-9_]{1,48}$/.test(name)) throw new TypeError('Valid tool name required');
  for (const [label, func] of Object.entries({ read, summarize, apply, readAfter, verify, idempotency, inverse })) {
    if (typeof func !== 'function') throw new TypeError(name + ': ' + label + ' must be a function');
  }
  for (const [label, func] of Object.entries({ prepare, beforeApply, afterApply, targetGuard, modeGuard, classifyError })) {
    if (func !== null && typeof func !== 'function') throw new TypeError(name + ': ' + label + ' must be a function');
  }
  if (typeof accountOf !== 'function' || typeof idempotencyPrefix !== 'string' ||
      !/^[a-z][a-z0-9_]{2,24}$/.test(idempotencyPrefix)) {
    throw new TypeError('Explicit service account binding and stable retry-key prefix are required');
  }
  if (needsConfirm !== true) throw new Error('Confirmation is required for every write before the safety layer is finished');
  const tool = Object.freeze({ name,
    description: 'Guarded write: preview and explicit confirmation required.',
    writes: true, writeContract: 'defineWrite-v1',
    inputSchema: { type: 'object',
      properties: { dryRun: { type: 'boolean' }, confirm: { type: 'boolean' },
        requestKey: { type: 'string', maxLength: 128 } },
      additionalProperties: true } });
  async function handler(args, ctx) {
    const connection = ctx?.connection;
    const respond = (value, isError = false) => {
      if (connection?.mode !== 'live') return reply(value, isError);
      const banner = { ...value };
      delete banner.mode;
      return reply({ mode: 'LIVE', ...banner }, isError);
    };
    let account = null;
    try { account = accountOf(connection); } catch { account = null; }
    if (typeof account !== 'string' || !account || !modes.has(connection?.mode) ||
      !profiles.has(connection?.profile)) {
      return respond({ done: false, error: 'This connection is not allowed to change provider records' }, true);
    }
    if (!ctx.db || typeof ctx.db.recordChange !== 'function') {
      return respond({ done: false, error: 'Audit database unavailable: action refused' }, true);
    }
    if (!args || typeof args !== 'object' || Array.isArray(args) ||
      (args.dryRun !== undefined && typeof args.dryRun !== 'boolean') ||
      (args.confirm !== undefined && typeof args.confirm !== 'boolean')) {
      return respond({ done: false, error: 'Invalid write arguments or confirmation flags' }, true);
    }
    if (connection.mode === 'live') {
      let permitted = false;
      try { permitted = typeof modeGuard === 'function' && await modeGuard(args, ctx) === true; }
      catch { permitted = false; }
      if (!permitted) return respond({
        done: false, error: 'LIVE changes are not enabled: owner approval, account settings and confirmation are required'
      }, true);
    }
    const before = await read(args, ctx);
    let guardContext = null;
    if (targetGuard) {
      const allowed = await targetGuard(args, ctx, before);
      if (allowed !== true && allowed?.allowed !== true) {
        return respond({ done: false, error: 'App-owned record or unsafe target',
          reason: typeof allowed === 'string' ? allowed : undefined }, true);
      }
      // Per invocation, no mutable global state or second customer lookup.
      guardContext = allowed === true ? null : { ownership:allowed.ownership };
    }
    const prepared = prepare ? await prepare(args, ctx, before) : null;
    if (prepared && (prepared.amountCents != null || prepared.direction != null) &&
        typeof beforeApply !== 'function') {
      return respond({ done: false, error: 'Independent server money authorization is required' }, true);
    }
    const summaryText = await summarize(before, args, ctx, guardContext);
    if (typeof summaryText !== 'string' || !summaryText || summaryText.length > 1024 ||
      (prepared !== null && (typeof prepared?.previewLine !== 'string' || !prepared.previewLine ||
       prepared.previewLine.length > 240))) {
      return respond({ done: false, error: 'Safe preview unavailable: action refused' }, true);
    }
    const summary = prepared ? prepared.previewLine + '\n' + summaryText : summaryText;
    const preview = { done: false, mode: connection.mode, preview: summary,
      needsConfirmation: args.confirm !== true };
    if (args.dryRun === true) {
      await ctx.db.recordChange({ account: account, mode: connection.mode,
        connection: ctx.connectionId ?? null, tool: name, summary, dryRun: true });
      return respond(preview);
    }
    if (args.confirm !== true) {
      return respond({ ...preview, prompt: 'Review the preview and explicitly set confirm: true' });
    }
    const key = idempotency(connection, name, args);
    if (typeof key !== 'string' || !key.startsWith(idempotencyPrefix)) {
      return respond({ done: false, error: 'Missing stable provider retry identifier' }, true);
    }
    // A safe preflight must complete before any provider write. If it fails
    // closed, a previous duplicate or rejected limit is never executed again.
    if (beforeApply) {
      let decision;
      try { decision = await beforeApply({ ctx, args, before, key, prepared, tool: name }); }
      catch { return respond({ done: false, error: 'Money safety check unavailable: action refused' }, true); }
      if (decision?.accepted !== true) {
        return respond({ done: false, error: decision?.reason || 'Safety check denied this action' }, true);
      }
    }
    try {
      await ctx.db.recordChange({ account: account, mode: connection.mode,
        connection: ctx.connectionId ?? null, tool: name, summary: 'PENDING: ' + summary,
        dryRun: true, idempotencyKey: key });
    } catch {
      // Capacity may remain reserved; conservative until manually reconciled.
      return respond({ done: false, error: 'Could not record intent; action not sent to provider' }, true);
    }
    let observed, completed = false, status = 'uncertain', applied = false;
    try {
      await apply(args, ctx, { idempotencyKey: key, before });
      applied = true;
    } catch (error) {
      // Only a verified definitive provider SDK rejection frees a reservation.
      // Transport, rate-limit, idempotency conflicts and unknown failures do not.
      status = classifyError(error) === 'rejected' ? 'rejected' : 'uncertain';
    }
    if (applied) {
      try {
        observed = await readAfter(args, ctx);
        completed = await verify(before, observed, args, ctx) === true;
        status = completed ? 'confirmed' : 'uncertain';
      } catch { status = 'uncertain'; }
    }
    try {
      if (afterApply) await afterApply({ ctx, args, before, key, prepared, status });
    } catch {
      return respond({ done: false, confirmed: false, idempotencyKey: key,
        warning: 'Provider outcome may have changed; could not finalize money reservation' }, true);
    }
    let inverseOperation;
    try {
      inverseOperation = completed ? await inverse(before, observed, args, ctx) : null;
      await ctx.db.recordChange({ account: account, mode: connection.mode,
        connection: ctx.connectionId ?? null, tool: name, summary: status === 'rejected' ? 'REJECTED: ' + summary : summary,
        before: null, after: null, dryRun: false, idempotencyKey: key,
        inverse: inverseOperation, amountCents: status === 'rejected' ? null : (prepared?.amountCents ?? null),
        currency: prepared?.currency ?? null, direction: prepared?.direction ?? null });
    } catch {
      return respond({ done: false, confirmed: false, idempotencyKey: key,
        warning: 'Provider action may have succeeded, but its audit could not be finalized' }, true);
    }
    return respond({ done: completed, confirmed: completed, mode: connection.mode,
      idempotencyKey: key, summary,
      ...(!completed ? { warning: status === 'rejected'
        ? 'provider definitively rejected the request; no money moved and the reservation was released'
        : 'Read-back did not confirm the change, or the provider outcome is uncertain' } : {}) });
  }
  return Object.freeze({ tool, handler });
}
