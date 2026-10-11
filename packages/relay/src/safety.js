// Defense in depth for a service that accidentally echoes a credential. The
// server contract forbids it, and encrypted delivery is not permission to return it.
export function safeRelayResult(result, pass) {
  const serialized = JSON.stringify(result);
  if (typeof serialized !== 'string') throw new Error('Invalid relay result');
  const sanitized = serialized.split(pass).join('[redacted]')
    .replace(/rtc_pass_[A-Za-z0-9_-]{43}/g, '[redacted]')
    .replace(/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}/g, '[redacted]')
    .replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, '[redacted]');
  return JSON.parse(sanitized);
}
