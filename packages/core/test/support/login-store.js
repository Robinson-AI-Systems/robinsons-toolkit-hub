// Test-only implementation of the three injected login-store methods.
// Stripe's giant provider DB fake is intentionally not an extraction dependency.
export function createFakeDb({ clock = () => Date.now() } = {}) {
  const attempts = [];
  return {
    async recordLoginAttempt(ip) {
      const id = attempts.length + 1;
      attempts.push({ id, ip, success: false, at: clock() });
      return id;
    },
    async countRecentFailedLogins(ip, minutes) {
      return attempts.filter(a => a.ip === ip && !a.success && a.at > clock() - minutes * 60000).length;
    },
    async markLoginAttemptSucceeded(id) {
      const item = attempts.find(a => a.id === id);
      if (item) item.success = true;
    }
  };
}
