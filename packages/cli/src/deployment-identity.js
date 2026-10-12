// Public deployment metadata is a self-report, never independent attestation.
// Admit only inert fields before comparing against independently verified pins.
const SHA = /^[a-f0-9]{40}$/;
const REF = /^[A-Za-z0-9_.-]{1,80}$/;
const ENV = new Set(['production', 'preview', 'development']);
export function publicDeploymentClaim(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) return null;
  const own = Object.getOwnPropertyDescriptors(value);
  if (!['sha', 'ref', 'environment'].every(k =>
    Object.hasOwn(own, k) && Object.hasOwn(own[k], 'value'))) return null;
  const sha = own.sha.value, ref = own.ref.value, environment = own.environment.value;
  if (typeof sha !== 'string' || !SHA.test(sha) ||
      typeof ref !== 'string' || !REF.test(ref) ||
      !ENV.has(environment)) return null;
  return { sha, ref, environment };
}
export function matchesDeploymentPin(advertised, independentlyVerifiedPin) {
  // The externally supplied pin is a strict operator decision, unlike the
  // remote service self-report (whose harmless extra fields are ignored).
  if (!independentlyVerifiedPin || typeof independentlyVerifiedPin !== 'object' ||
      Object.keys(independentlyVerifiedPin).some(k =>
        !['sha', 'ref', 'environment'].includes(k))) return false;
  const claim = publicDeploymentClaim(advertised);
  const pin = publicDeploymentClaim(independentlyVerifiedPin);
  return !!(claim && pin && claim.sha === pin.sha &&
    claim.ref === pin.ref && claim.environment === pin.environment);
}
