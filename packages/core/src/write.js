// Source-equivalent guarded write lifecycle with required server-owned account and key adapters.
// Independently authenticated money approval and shared limits MUST be supplied by each service.
import { isInertJsonData } from './mcp-dispatch.js';

const reply = (value, isError = false) => ({
  ...(isError ? { isError: true } : {}),
  content: [{ type: 'text', text: JSON.stringify(value) }]
});
const modes = new Set(['test', 'live']); // LIVE additionally requires injected server-only guard.
const profiles = new Set(['everyday', 'full']);

// An untrusted provider preview or ownership row must not be aliased through
// asynchronous service hooks after the preview has been independently checked.
function frozenJsonCopy(value) {
  const frozen = structuredClone(value);
  function freeze(node) {
    if (node !== null && typeof node === 'object') {
      for (const child of Object.values(node)) freeze(child);
      Object.freeze(node);
    }
    return node;
  }
  return freeze(frozen);
}

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
    // Bind one inert, detached service connection across all async hooks.
    // A mutable caller ctx must not turn an approved TEST account into LIVE,
    // switch owner identity, or silently redirect the subsequent audit.
    let connection;
    try {
      if (!ctx || ![Object.prototype,null].includes(Object.getPrototypeOf(ctx)) ||
          Reflect.ownKeys(ctx).some(key=>typeof key!=='string')) throw new TypeError('Unsafe write context');
      const descriptors=Object.getOwnPropertyDescriptors(ctx);
      const fields=Object.entries(descriptors);
      if (fields.some(([,field])=>!field.enumerable || !Object.hasOwn(field,'value')) ||
          !Object.hasOwn(descriptors,'connection') || !Object.hasOwn(descriptors,'db')) {
        throw new TypeError('Unsafe write context');
      }
      if (!descriptors.connection.value || Array.isArray(descriptors.connection.value) ||
          !isInertJsonData(descriptors.connection.value) ||
          ![Object.prototype,null].includes(Object.getPrototypeOf(descriptors.connection.value))) {
        throw new TypeError('Unsafe connection identity');
      }
      const id=descriptors.connectionId?.value;
      if (id!==undefined && id!==null && (typeof id!=='string' ||
          id.length>256 || /[\x00-\x1f\x7f]/.test(id))) {
        throw new TypeError('Invalid connection audit identifier');
      }
      connection=frozenJsonCopy(descriptors.connection.value);
      ctx=Object.freeze(Object.fromEntries(fields.map(([key,field])=>[
        key,key==='connection'?connection:field.value
      ])));
    } catch {
      return reply({done:false,error:'This connection is not allowed to change provider records'},true);
    }
    const respond = (value, isError = false) => {
      if (connection?.mode !== 'live') return reply(value, isError);
      const banner = { ...value };
      delete banner.mode;
      return reply({ mode: 'LIVE', ...banner }, isError);
    };
    let account = null;
    try { account = accountOf(connection); } catch { account = null; }
    if (typeof account !== 'string' || !account.trim() || account !== account.trim() ||
      account.length > 256 || /[\x00-\x1f\x7f]/.test(account) ||
      !modes.has(connection?.mode) || !profiles.has(connection?.profile)) {
      return respond({ done: false, error: 'This connection is not allowed to change provider records' }, true);
    }
    if (!ctx.db || typeof ctx.db.recordChange !== 'function') {
      return respond({ done: false, error: 'Audit database unavailable: action refused' }, true);
    }
    if (!args || typeof args !== 'object' || Array.isArray(args) || !isInertJsonData(args)) {
      return respond({ done: false, error: 'Invalid write arguments or confirmation flags' }, true);
    }
    // All policy, preview, retry and provider hooks must see one immutable
    // request. Otherwise async read/approval can rewrite args after consent.
    try { args = frozenJsonCopy(args); }
    catch { return respond({ done: false, error: 'Invalid write arguments or confirmation flags' }, true); }
    let confirmed = false, dryRunRequested = false;
    try {
      // Own data descriptors are required: prototype pollution and accessor
      // getters may not silently supply or alter irreversible write consent.
      const proto = Object.getPrototypeOf(args);
      if (proto !== Object.prototype && proto !== null) throw new TypeError('Unsafe write arguments');
      const dryRun = Object.getOwnPropertyDescriptor(args, 'dryRun');
      const confirm = Object.getOwnPropertyDescriptor(args, 'confirm');
      for (const flag of [dryRun, confirm]) {
        if (flag && (!Object.hasOwn(flag, 'value') || typeof flag.value !== 'boolean')) {
          throw new TypeError('Invalid confirmation descriptor');
        }
      }
      confirmed = confirm?.value === true;
      dryRunRequested = dryRun?.value === true;
    } catch {
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
    // An upstream read error is not safe to expose: the provider may include
    // account identifiers, authorization headers or other private details.
    // Refuse before any provider mutation or audit intent is created.
    let before;
    try { before = await read(args, ctx); }
    catch { return respond({ done: false, error: 'Provider preflight unavailable: change refused' }, true); }
    let guardContext = null;
    if (targetGuard) {
      let allowed;
      try { allowed = await targetGuard(args, ctx, before); }
      catch { return respond({ done: false, error: 'Ownership check unavailable: change refused' }, true); }
      // A service-owned ownership decision is privileged input. Never read a
      // getter or executable nested ownership record to authorize a write.
      const accepted = allowed === true ||
        (isInertJsonData(allowed) && allowed !== null &&
          typeof allowed === 'object' && !Array.isArray(allowed) &&
          allowed.allowed === true);
      if (!accepted) {
        return respond({ done: false, error: 'App-owned record or unsafe target',
          reason: typeof allowed === 'string' ? allowed : undefined }, true);
      }
      // Bind an immutable ownership snapshot; later hooks must not change the
      // authorizer's account/target decision by mutating an aliased object.
      if (allowed !== true) {
        try {
          guardContext = Object.freeze({ ownership: Object.hasOwn(allowed, 'ownership')
            ? frozenJsonCopy(allowed.ownership) : undefined });
        } catch {
          return respond({ done: false, error: 'App-owned record or unsafe target' }, true);
        }
      }
    }
    let prepared;
    try { prepared = prepare ? await prepare(args, ctx, before) : null; }
    catch { return respond({ done: false, error: 'Provider preview unavailable: action refused' }, true); }
    if (prepared !== null) {
      if (!isInertJsonData(prepared)) {
        return respond({ done: false, error: 'Invalid provider-derived money preview: action refused' }, true);
      }
      try { prepared = frozenJsonCopy(prepared); }
      catch {
        return respond({ done: false, error: 'Invalid provider-derived money preview: action refused' }, true);
      }
    }
    // Even a partially populated money preview is monetary, not an ordinary write.
    // Reject malformed provider-derived amounts before consulting approval or sending a write.
    const moneyIntent = prepared !== null && typeof prepared === 'object' &&
      !Array.isArray(prepared) &&
      ['amountCents', 'currency', 'direction'].some(field =>
        Object.hasOwn(prepared, field));
    if (moneyIntent && (!Number.isSafeInteger(prepared.amountCents) ||
      prepared.amountCents <= 0 || !/^[a-z]{3}$/.test(prepared.currency) ||
      !['in', 'out'].includes(prepared.direction))) {
      return respond({ done: false, error: 'Invalid provider-derived money preview: action refused' }, true);
    }
    if (moneyIntent && typeof beforeApply !== 'function') {
      return respond({ done: false, error: 'Independent server money authorization is required' }, true);
    }
    let summaryText;
    try { summaryText = await summarize(before, args, ctx, guardContext); }
    catch { return respond({ done: false, error: 'Safe preview unavailable: action refused' }, true); }
    if (typeof summaryText !== 'string' || !summaryText || summaryText.length > 1024 ||
      (prepared !== null && (typeof prepared?.previewLine !== 'string' || !prepared.previewLine ||
       prepared.previewLine.length > 240))) {
      return respond({ done: false, error: 'Safe preview unavailable: action refused' }, true);
    }
    const summary = prepared ? prepared.previewLine + '\n' + summaryText : summaryText;
    const preview = { done: false, mode: connection.mode, preview: summary,
      needsConfirmation: !confirmed };
    if (dryRunRequested) {
      await ctx.db.recordChange({ account: account, mode: connection.mode,
        connection: ctx.connectionId ?? null, tool: name, summary, dryRun: true });
      return respond(preview);
    }
    if (!confirmed) {
      return respond({ ...preview, prompt: 'Review the preview and explicitly set confirm: true' });
    }
    let key;
    try { key = idempotency(connection, name, args); }
    catch { return respond({ done: false, error: 'Missing stable provider retry identifier' }, true); }
    if (typeof key !== 'string' || !key.startsWith(idempotencyPrefix) ||
      !/^[\x21-\x7e]{1,255}$/.test(key)) {
      return respond({ done: false, error: 'Missing stable provider retry identifier' }, true);
    }
    // A safe preflight must complete before any provider write. If it fails
    // closed, a previous duplicate or rejected limit is never executed again.
    if (beforeApply) {
      let decision;
      try { decision = await beforeApply({ ctx, args, before, key, prepared, tool: name }); }
      catch { return respond({ done: false, error: 'Money safety check unavailable: action refused' }, true); }
      if (!isInertJsonData(decision) || decision?.accepted !== true) {
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
      // A broken classifier cannot erase a possibly executed provider operation.
      // Preserve the reservation and continue durable audit as uncertain.
      try { status = classifyError(error) === 'rejected' ? 'rejected' : 'uncertain'; }
      catch { status = 'uncertain'; }
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
