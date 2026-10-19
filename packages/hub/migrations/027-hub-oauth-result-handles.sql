-- Optional H-3 OAuth read results: independent from RTC1 pass-backed
-- result handles; no bearer, raw handle or plaintext persists.
CREATE TABLE IF NOT EXISTS hub_upstream_oauth_result_handles (
 handle_digest TEXT PRIMARY KEY CHECK(length(handle_digest)=64),
 owner_id TEXT NOT NULL,
 caller_digest TEXT NOT NULL CHECK(length(caller_digest)=64),
 connection_id UUID NOT NULL REFERENCES hub_upstream_oauth_connections(id),
 server_name TEXT NOT NULL,
 scope_digest TEXT NOT NULL CHECK(length(scope_digest)=64),
 ciphertext BYTEA NOT NULL,
 nonce BYTEA NOT NULL CHECK(octet_length(nonce)=12),
 tag BYTEA NOT NULL CHECK(octet_length(tag)=16),
 plain_bytes INTEGER NOT NULL CHECK(plain_bytes BETWEEN 1 AND 65536),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '1 hour')
);
CREATE INDEX IF NOT EXISTS hub_oauth_results_expiry ON hub_upstream_oauth_result_handles(expires_at);
CREATE INDEX IF NOT EXISTS hub_oauth_results_connection ON hub_upstream_oauth_result_handles(connection_id);
