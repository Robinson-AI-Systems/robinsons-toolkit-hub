export function createReplayStore(db) {
  if (typeof db?.query !== 'function') throw new Error('Replay database required');
  return {
    async claim(id) {
      if (!/^[0-9a-f-]{36}$/.test(id || '')) throw new Error('Invalid replay ID');
      const result = await db.query(
        'INSERT INTO relay_seen (request_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING request_id', [id]);
      return result.rowCount === 1;
    },
    async prune() {
      // Requests expire after five minutes; keep IDs for a day for safe overlap.
      const result = await db.query("DELETE FROM relay_seen WHERE seen_at < now() - interval '1 day'");
      return result.rowCount;
    }
  };
}
