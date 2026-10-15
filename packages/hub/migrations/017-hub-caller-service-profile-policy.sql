-- H-4 additive, irrevocable, caller-owned service profile reductions.
-- Provider grants and independent RTC pass ciphertext are unchanged.
ALTER TABLE hub_callers ADD COLUMN IF NOT EXISTS service_profile_policy JSONB;
ALTER TABLE hub_oauth_sessions ADD COLUMN IF NOT EXISTS service_profile_policy JSONB;
ALTER TABLE hub_oauth_codes ADD COLUMN IF NOT EXISTS service_profile_policy JSONB;
ALTER TABLE hub_oauth_codes DROP CONSTRAINT IF EXISTS hub_code_profile_policy_object;
ALTER TABLE hub_oauth_codes ADD CONSTRAINT hub_code_profile_policy_object
 CHECK(service_profile_policy IS NULL OR
  jsonb_typeof(service_profile_policy)='object');
ALTER TABLE hub_callers DROP CONSTRAINT IF EXISTS hub_pass_profile_policy_object;
ALTER TABLE hub_callers ADD CONSTRAINT hub_pass_profile_policy_object
 CHECK(service_profile_policy IS NULL OR
  jsonb_typeof(service_profile_policy)='object');
ALTER TABLE hub_oauth_sessions DROP CONSTRAINT IF EXISTS hub_oauth_profile_policy_object;
ALTER TABLE hub_oauth_sessions ADD CONSTRAINT hub_oauth_profile_policy_object
 CHECK(service_profile_policy IS NULL OR
  jsonb_typeof(service_profile_policy)='object');
CREATE TABLE IF NOT EXISTS hub_caller_profile_audit(
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 owner_id TEXT NOT NULL,
 caller_kind TEXT NOT NULL CHECK(caller_kind IN('pass','oauth')),
 caller_id TEXT NOT NULL,
 server_name TEXT NOT NULL,
 profile TEXT NOT NULL CHECK(profile IN ('read_only','disabled')),
 affected_sessions INTEGER NOT NULL CHECK(affected_sessions>=1),
 purged_handles INTEGER NOT NULL CHECK(purged_handles>=0)
);
CREATE INDEX IF NOT EXISTS hub_caller_profile_audit_owner_at
 ON hub_caller_profile_audit(owner_id,id DESC);
