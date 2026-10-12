// Shared read-only JSON evidence transport. Intentionally never sends credentials.
// Each caller owns its checked GitHub URL, status policy and release decisions.
export async function githubEvidenceJson(fetchImpl, url, {
  signal, unavailable, failed, malformed
} = {}) {
  if (typeof fetchImpl !== 'function') throw Error(unavailable);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/vnd.github+json' }, signal
    });
  } catch {
    throw Error(unavailable);
  }
  if (!response?.ok) throw Error(failed(String(response?.status || 'unknown')));
  try {
    return await response.json();
  } catch {
    throw Error(malformed);
  }
}
