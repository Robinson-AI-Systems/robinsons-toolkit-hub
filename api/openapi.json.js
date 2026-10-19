// Read-only Hub and caller-scoped TEST/LIVE RTC HTTPS; RTC 1 conformance remains OPEN.
const operation = (summary, method) => ({
  [method]: { summary, responses: { 200: { description: 'Successful result' },
    401: { description: 'Scoped Hub pass required' } },
  security: [{ hubPass: [] }] }
});
const document = {
  openapi: '3.0.3',
  info: { title: 'Robinson Toolkit Hub Foundation', version: '0.1.0' },
  paths: {
    '/api/tools': operation('Search bounded Hub-owned and caller-authorized TEST/LIVE RTC read tools', 'get'),
    '/api/tools/{name}': {
      ...operation('Describe a Hub or caller-authorized TEST/LIVE RTC read tool', 'get'),
      ...operation('Invoke a guarded Hub tool or independently authorized RTC read', 'post'),
      parameters: [{ in: 'path', name: 'name', required: true,
        schema: { type: 'string' } }]
    },
    '/api/tools/_batch': operation('Execute up to ten sequential authorized Hub/RTC TEST/LIVE reads', 'post'),
    '/api/results/{handle}': {
      ...operation('Read a caller-owned encrypted result page; RTC pages revalidate the original grant', 'get'),
      parameters: [{ in: 'path', name: 'handle', required: true,
        schema: { type: 'string', pattern: '^(rtc_)?[A-Za-z0-9_-]{43}$' } },
      { in: 'query', name: 'page', required: false,
        schema: { type: 'integer', minimum: 0, maximum: 15, default: 0 } }]
    },
    '/api/whoami': operation('Inspect Hub pass scope', 'get')
  },
  components: { securitySchemes: { hubPass: { type: 'http', scheme: 'bearer' } } }
};
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  return res.status(200).json(document);
}
