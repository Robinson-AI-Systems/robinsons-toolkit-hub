-- H-3 append-only audit for genuine upstream RTC read forwarding.
-- Both pass and OAuth actors receive exact session foreign keys. Correlation
-- groups dispatch and outcome without ever storing a bearer or tool arguments.
CREATE TABLE IF NOT EXISTS hub_rtc_read_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 owner_id TEXT NOT NULL,
 caller_kind TEXT NOT NULL CHECK(caller_kind IN ('pass','oauth')),
 caller_id TEXT NOT NULL,
 pass_caller_id TEXT REFERENCES hub_callers(id),
 oauth_session_id TEXT REFERENCES hub_oauth_sessions(id),
 grant_id UUID NOT NULL REFERENCES hub_server_grants(id),
 server_name TEXT NOT NULL REFERENCES hub_servers(name),
 tool_name TEXT NOT NULL CHECK(length(tool_name) BETWEEN 3 AND 120),
 correlation_id UUID NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('attempt','outcome')),
 outcome TEXT NOT NULL CHECK(outcome IN ('allowed','success','refused','unavailable')),
 upstream_log_id TEXT CHECK(length(upstream_log_id)<=128),
 CHECK ((caller_kind='pass' AND pass_caller_id=caller_id AND oauth_session_id IS NULL)
  OR (caller_kind='oauth' AND oauth_session_id=caller_id AND pass_caller_id IS NULL))
);
CREATE INDEX IF NOT EXISTS hub_rtc_audit_actor_idx
 ON hub_rtc_read_audit(owner_id,caller_kind,caller_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS hub_rtc_audit_correlation_idx
 ON hub_rtc_read_audit(correlation_id,occurred_at);
