-- H-2/H-4 MCP OAuth client: owner/caller-family isolated, issuer-owned tokens.
-- Deliberately independent from historical RTC HTTPS pass-only grants.
-- Tokens and DCR client secrets are encrypted with HUB_GRANTS_KEY (AES-GCM).
CREATE TABLE IF NOT EXISTS hub_upstream_oauth_flows (
 state_digest TEXT PRIMARY KEY CHECK(length(state_digest)=64),
 browser_digest TEXT NOT NULL CHECK(length(browser_digest)=64),
 owner_id TEXT NOT NULL,
 caller_family TEXT NOT NULL,
 service_name TEXT NOT NULL,
 origin TEXT NOT NULL,
 resource TEXT NOT NULL,
 issuer TEXT NOT NULL,
 token_endpoint TEXT NOT NULL,
 client_id TEXT NOT NULL,
 secret_enc BYTEA NOT NULL,
 secret_nonce BYTEA NOT NULL CHECK(octet_length(secret_nonce)=12),
 secret_tag BYTEA NOT NULL CHECK(octet_length(secret_tag)=16),
 requested_scopes TEXT NOT NULL DEFAULT '',
 requested_mode TEXT NOT NULL CHECK(requested_mode IN ('test','live')),
 requested_profile TEXT NOT NULL CHECK(requested_profile IN ('read_only','everyday','full')),
 allowed_areas TEXT[] NOT NULL CHECK(cardinality(allowed_areas) BETWEEN 1 AND 32),
 expires_at TIMESTAMPTZ NOT NULL,
 consumed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_oauth_flow_expires ON hub_upstream_oauth_flows(expires_at);

CREATE TABLE IF NOT EXISTS hub_upstream_oauth_connections (
 id UUID PRIMARY KEY,
 owner_id TEXT NOT NULL,
 caller_family TEXT NOT NULL,
 service_name TEXT NOT NULL,
 origin TEXT NOT NULL,
 resource TEXT NOT NULL,
 issuer TEXT NOT NULL,
 token_endpoint TEXT NOT NULL,
 client_id TEXT NOT NULL,
 secret_enc BYTEA NOT NULL,
 secret_nonce BYTEA NOT NULL CHECK(octet_length(secret_nonce)=12),
 secret_tag BYTEA NOT NULL CHECK(octet_length(secret_tag)=16),
 authorized_scopes TEXT NOT NULL DEFAULT '',
 allowed_areas TEXT[] NOT NULL CHECK(cardinality(allowed_areas) BETWEEN 1 AND 32),
 mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 profile TEXT NOT NULL CHECK(profile IN ('read_only','everyday','full')),
 access_expires_at TIMESTAMPTZ NOT NULL,
 refresh_available BOOLEAN NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS hub_upstream_oauth_active
 ON hub_upstream_oauth_connections(owner_id,caller_family,service_name)
 WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS hub_upstream_oauth_connection_expiry
 ON hub_upstream_oauth_connections(access_expires_at)
 WHERE revoked_at IS NULL;
