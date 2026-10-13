-- Additive OAuth 2.1 PKCE identity storage; no provider OAuth tokens enter this schema.
CREATE TABLE IF NOT EXISTS hub_oauth_clients (
 client_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 redirect_uri TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hub_oauth_codes (
 code_digest TEXT PRIMARY KEY,
 client_id TEXT NOT NULL REFERENCES hub_oauth_clients(client_id),
 owner_id TEXT NOT NULL,
 redirect_uri TEXT NOT NULL,
 challenge TEXT NOT NULL,
 profile TEXT NOT NULL CHECK(profile IN ('read_only','everyday','full')),
 areas TEXT[] NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 expires_at TIMESTAMPTZ NOT NULL,
 consumed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS hub_oauth_sessions (
 id TEXT PRIMARY KEY,
 family_id TEXT NOT NULL,
 owner_id TEXT NOT NULL,
 client_id TEXT NOT NULL REFERENCES hub_oauth_clients(client_id),
 access_digest TEXT NOT NULL UNIQUE,
 refresh_digest TEXT NOT NULL UNIQUE,
 profile TEXT NOT NULL CHECK(profile IN ('read_only','everyday','full')),
 areas TEXT[] NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 access_expires_at TIMESTAMPTZ NOT NULL,
 refresh_expires_at TIMESTAMPTZ NOT NULL,
 refresh_used_at TIMESTAMPTZ,
 revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS hub_oauth_family_idx ON hub_oauth_sessions(family_id);
