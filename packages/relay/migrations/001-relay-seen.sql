-- Request IDs only. Never store passes, tool arguments, replies or encryption keys.
CREATE TABLE IF NOT EXISTS relay_seen (
  request_id TEXT PRIMARY KEY,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relay_seen_age ON relay_seen (seen_at);
