-- H-4 one-way service-specific caller area overlays, additive and read-only.
-- NULL is legacy exact-caller grant scope. This never touches provider
-- credentials, encrypted grants, original grant scopes or RTC AAD.
ALTER TABLE hub_callers ADD COLUMN IF NOT EXISTS service_area_policy JSONB;
ALTER TABLE hub_oauth_sessions ADD COLUMN IF NOT EXISTS service_area_policy JSONB;
ALTER TABLE hub_callers DROP CONSTRAINT IF EXISTS hub_pass_area_policy_object;
ALTER TABLE hub_callers ADD CONSTRAINT hub_pass_area_policy_object
 CHECK(service_area_policy IS NULL OR jsonb_typeof(service_area_policy)='object');
ALTER TABLE hub_oauth_sessions DROP CONSTRAINT IF EXISTS hub_oauth_area_policy_object;
ALTER TABLE hub_oauth_sessions ADD CONSTRAINT hub_oauth_area_policy_object
 CHECK(service_area_policy IS NULL OR jsonb_typeof(service_area_policy)='object');
CREATE TABLE IF NOT EXISTS hub_caller_service_area_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 owner_id TEXT NOT NULL,
 caller_kind TEXT NOT NULL CHECK(caller_kind IN ('pass','oauth')),
 caller_id TEXT NOT NULL,
 server_name TEXT NOT NULL,
 areas TEXT[] NOT NULL CHECK(cardinality(areas) BETWEEN 1 AND 32),
 affected_sessions INTEGER NOT NULL CHECK(affected_sessions>=1),
 purged_handles INTEGER NOT NULL CHECK(purged_handles>=0)
);
CREATE INDEX IF NOT EXISTS hub_caller_service_area_audit_owner_at
 ON hub_caller_service_area_audit(owner_id,occurred_at DESC);
