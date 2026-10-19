-- H-3 real MCP OAuth reads use their OWN connection ledger, never
-- impersonate a pass-backed hub_server_grants foreign key.
CREATE TABLE IF NOT EXISTS hub_upstream_oauth_read_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 owner_id TEXT NOT NULL,
 caller_family TEXT NOT NULL,
 connection_id UUID NOT NULL REFERENCES hub_upstream_oauth_connections(id),
 service_name TEXT NOT NULL,
 tool_name TEXT NOT NULL,
 correlation_id UUID NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('attempt','outcome')),
 outcome TEXT NOT NULL CHECK(
  (phase='attempt' AND outcome='allowed') OR
  (phase='outcome' AND outcome IN ('success','refused','unavailable'))),
 upstream_log_id TEXT,
 CHECK(upstream_log_id IS NULL OR length(upstream_log_id)<=128)
);
CREATE INDEX IF NOT EXISTS hub_upstream_oauth_audit_owner
 ON hub_upstream_oauth_read_audit(owner_id,caller_family,id DESC);
CREATE INDEX IF NOT EXISTS hub_upstream_oauth_audit_correlation
 ON hub_upstream_oauth_read_audit(connection_id,correlation_id,id);
