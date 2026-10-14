-- Dedicated encrypted RTC forwarding results. H-1 result handles are unchanged.
-- Readers must revalidate the exact currently active caller's independent grant
-- before decrypting. Plaintext, bearer credentials and raw handles never persist.
CREATE TABLE IF NOT EXISTS hub_rtc_result_handles (
 handle_digest TEXT PRIMARY KEY CHECK(length(handle_digest)=64),
 owner_id TEXT NOT NULL,
 caller_digest TEXT NOT NULL CHECK(length(caller_digest)=64),
 grant_id UUID NOT NULL,
 server_name TEXT NOT NULL CHECK(server_name ~ '^[a-z][a-z0-9_]{1,59}$'),
 ciphertext BYTEA NOT NULL,
 nonce BYTEA NOT NULL CHECK(octet_length(nonce)=12),
 tag BYTEA NOT NULL CHECK(octet_length(tag)=16),
 plain_bytes INTEGER NOT NULL CHECK(plain_bytes BETWEEN 1 AND 65536),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '1 hour')
);
CREATE INDEX IF NOT EXISTS hub_rtc_results_expiry_idx ON hub_rtc_result_handles(expires_at);
CREATE INDEX IF NOT EXISTS hub_rtc_results_grant_idx ON hub_rtc_result_handles(grant_id);
