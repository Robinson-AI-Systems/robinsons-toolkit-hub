// A reserved envelope supports every RTC HTTPS door, never arbitrary HTTP.
export function relayHttpRoute(args) {
  if (!args || typeof args.path !== 'string' || args.path.length > 4096 ||
      !['GET', 'POST'].includes(args.method) || !args.path.startsWith('/api/'))
    throw new Error('Unsupported relay HTTP route');
  const url = new URL(args.path, 'https://rtc.invalid');
  if (url.origin !== 'https://rtc.invalid' || url.hash || url.pathname.includes('%') ||
      args.path.split('?')[0] !== url.pathname) throw new Error('Unsafe relay HTTP route');
  const get = url.pathname === '/api/contract' || url.pathname === '/api/whoami' ||
    url.pathname === '/api/tools' || /^\/api\/tools\/[a-z][a-z0-9_]{0,199}$/.test(url.pathname) ||
    /^\/api\/results\/[A-Za-z0-9_-]{1,200}$/.test(url.pathname);
  const post = /^\/api\/tools\/(?:[a-z][a-z0-9_]{0,199}|_batch)$/.test(url.pathname);
  if ((args.method === 'GET' && !get) || (args.method === 'POST' && !post))
    throw new Error('Unsupported relay HTTP route');
  const allowed = url.pathname === '/api/tools' ?
    ['q', 'area', 'audience', 'limit', 'next', 'cursor', 'page', 'listing'] :
    url.pathname.startsWith('/api/results/') ? ['page', 'fields', 'limit', 'next', 'cursor'] : [];
  for (const [key, value] of url.searchParams) {
    if (!allowed.includes(key) || value.length > 2000 || url.searchParams.getAll(key).length > 1)
      throw new Error('Unsupported relay query');
  }
  if (args.method === 'POST' && (!args.body || typeof args.body !== 'object' || Array.isArray(args.body)))
    throw new Error('Relay POST needs object body');
  if (args.method === 'GET' && args.body !== undefined) throw new Error('Relay GET body refused');
  return { path: url.pathname + url.search, method: args.method, body: args.body };
}
