-- Additive Hub-owned identity and audit foundation; never store raw passes or provider credentials.
CREATE TABLE IF NOT EXISTS hub_callers (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 pass_digest TEXT NOT NULL UNIQUE,
 profile TEXT NOT NULL CHECK (profile IN ('read_only', 'everyday', 'full')),
 allowed_areas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 mode TEXT NOT NULL CHECK (mode IN ('test','live')),
 allow_writes BOOLEAN NOT NULL DEFAULT FALSE,
 issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ,
 CHECK (expires_at > issued_at)
);
CREATE INDEX IF NOT EXISTS hub_callers_owner_idx ON hub_callers(owner_id, issued_at DESC);
CREATE TABLE IF NOT EXISTS hub_request_limits (
 scope_digest TEXT NOT NULL,
 bucket BIGINT NOT NULL,
 hits INTEGER NOT NULL CHECK(hits >= 1),
 PRIMARY KEY (scope_digest, bucket)
);
CREATE TABLE IF NOT EXISTS hub_forward_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 caller_id TEXT NOT NULL REFERENCES hub_callers(id),
 grant_id TEXT,
 service TEXT,
 tool TEXT,
 action TEXT NOT NULL,
 outcome TEXT NOT NULL,
 upstream_log_id TEXT,
 CONSTRAINT hub_audit_safe_outcome CHECK(length(outcome) <= 80)
);
CREATE INDEX IF NOT EXISTS hub_forward_audit_caller_idx ON hub_forward_audit(caller_id,occurred_at DESC);
