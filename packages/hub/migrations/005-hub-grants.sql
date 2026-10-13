-- Separately issued RTC passes: encrypted at rest, never shared between Hub callers.
-- Staging grants does not activate remote service access.
CREATE TABLE IF NOT EXISTS hub_server_grants (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  server_name TEXT NOT NULL REFERENCES hub_servers(name),
  caller_kind TEXT NOT NULL CHECK(caller_kind IN ('pass','oauth')),
  caller_id TEXT NOT NULL,
  pass_caller_id TEXT REFERENCES hub_callers(id),
  oauth_session_id TEXT REFERENCES hub_oauth_sessions(id),
  profile TEXT NOT NULL DEFAULT 'read_only' CHECK(profile='read_only'),
  mode TEXT NOT NULL DEFAULT 'test' CHECK(mode='test'),
  areas TEXT[] NOT NULL CHECK(cardinality(areas) BETWEEN 1 AND 32),
  ciphertext BYTEA NOT NULL,
  nonce BYTEA NOT NULL CHECK(octet_length(nonce)=12),
  tag BYTEA NOT NULL CHECK(octet_length(tag)=16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at>created_at AND expires_at<=created_at+interval '30 days'),
  CHECK ((caller_kind='pass' AND pass_caller_id=caller_id AND oauth_session_id IS NULL)
    OR (caller_kind='oauth' AND oauth_session_id=caller_id AND pass_caller_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS hub_grants_active_identity
  ON hub_server_grants(owner_id,server_name,caller_kind,caller_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS hub_grants_expiry_idx ON hub_server_grants(expires_at);
