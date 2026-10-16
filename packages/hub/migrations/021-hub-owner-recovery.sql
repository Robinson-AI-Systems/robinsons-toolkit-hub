-- Owner-approved recovery keeps the existing passphrase valid until a
-- Vercel-controlled one-time code and replacement are committed atomically.
-- Only a keyed digest is stored; never the plaintext code or passphrase.
CREATE TABLE IF NOT EXISTS hub_owner_recovery_uses (
 code_digest TEXT PRIMARY KEY CHECK (code_digest ~ '^[a-f0-9]{64}$'),
 owner_id TEXT NOT NULL REFERENCES hub_owner_credentials(owner_id),
 consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_owner_recovery_owner_idx
 ON hub_owner_recovery_uses(owner_id,consumed_at DESC);
