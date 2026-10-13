-- Builder handoffs and first-time owner setup; no provider keys enter these tables.
CREATE TABLE IF NOT EXISTS hub_owner_credentials (
 owner_id TEXT PRIMARY KEY, verifier TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hub_developer_clients (
 client_id TEXT PRIMARY KEY REFERENCES hub_oauth_clients(client_id),
 secret_digest TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS hub_developer_handoffs (
 state TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES hub_developer_clients(client_id),
 challenge TEXT NOT NULL, poll_hash TEXT NOT NULL, public_key TEXT NOT NULL,
 profile TEXT NOT NULL CHECK(profile IN ('read_only','everyday','full')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','authorized','denied')),
 sealed_code TEXT, expires_at TIMESTAMPTZ NOT NULL,
 UNIQUE(client_id)
);
