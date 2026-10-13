-- Ephemeral encrypted caller-owned results, no raw handles or plaintext.
CREATE TABLE IF NOT EXISTS hub_result_handles (
 handle_digest TEXT PRIMARY KEY CHECK(length(handle_digest)=64),
 owner_id TEXT NOT NULL,
 caller_digest TEXT NOT NULL CHECK(length(caller_digest)=64),
 ciphertext BYTEA NOT NULL,
 nonce BYTEA NOT NULL CHECK(octet_length(nonce)=12),
 tag BYTEA NOT NULL CHECK(octet_length(tag)=16),
 plain_bytes INTEGER NOT NULL CHECK(plain_bytes BETWEEN 1 AND 65536),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '24 hours')
);
CREATE INDEX IF NOT EXISTS hub_results_expiry_idx ON hub_result_handles(expires_at);
