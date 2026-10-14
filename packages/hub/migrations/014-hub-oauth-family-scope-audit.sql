-- H-4 independent owner narrowing of a PKCE refresh family's existing
-- RTC server selection. Audit is metadata only; no OAuth or RTC secret.
CREATE TABLE IF NOT EXISTS hub_oauth_family_scope_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id TEXT NOT NULL,
 family_id TEXT NOT NULL,
 session_id TEXT NOT NULL,
 server_names TEXT[] NOT NULL CHECK(cardinality(server_names) BETWEEN 1 AND 20),
 affected_sessions INTEGER NOT NULL CHECK(affected_sessions>0),
 purged_handles INTEGER NOT NULL CHECK(purged_handles>=0),
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_oauth_family_scope_audit_owner_idx
 ON hub_oauth_family_scope_audit(owner_id,occurred_at DESC);
