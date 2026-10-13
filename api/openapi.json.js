// Read-only H-1 API specification; this does not assert RTC 1 conformance.
const operation = (summary, method) => ({
  [method]: { summary, responses: { 200: { description: 'Successful result' },
    401: { description: 'Scoped Hub pass required' } },
  security: [{ hubPass: [] }] }
});
const document = {
  openapi: '3.0.3',
  info: { title: 'Robinson Toolkit Hub Foundation', version: '0.1.0' },
  paths: {
    '/api/tools': operation('Search bounded Hub-owned tools', 'get'),
    '/api/tools/{name}': {
      ...operation('Describe a Hub-owned tool', 'get'),
      ...operation('Run a harmless Hub-owned tool', 'post'),
      parameters: [{ in: 'path', name: 'name', required: true,
        schema: { type: 'string' } }]
    },
    '/api/tools/_batch': operation('Execute up to ten harmless Hub-owned reads', 'post'),
    '/api/whoami': operation('Inspect Hub pass scope', 'get')
  },
  components: { securitySchemes: { hubPass: { type: 'http', scheme: 'bearer' } } }
};
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  return res.status(200).json(document);
}
