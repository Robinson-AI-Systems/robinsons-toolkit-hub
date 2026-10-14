-- H-4 owner-only revocation audit. No OAuth bearer, digest, provider pass,
-- tool arguments or result plaintext is retained. Additive and no LIVE path.
CREATE TABLE IF NOT EXISTS hub_oauth_owner_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  sample_session_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action='revoke'),
  affected_sessions INTEGER NOT NULL CHECK(affected_sessions>0),
  purged_handles INTEGER NOT NULL CHECK(purged_handles>=0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_oauth_owner_audit_owner_idx
  ON hub_oauth_owner_audit(owner_id,occurred_at DESC);
