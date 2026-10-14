-- H-4: independently approved PKCE owner consent can narrow a family to
-- selected registered RTC service names. NULL preserves older exact-client
-- and exact-caller grant semantics; [] denies all services. No LIVE scope.
ALTER TABLE hub_oauth_codes
  ADD COLUMN IF NOT EXISTS allowed_servers TEXT[];
ALTER TABLE hub_oauth_sessions
  ADD COLUMN IF NOT EXISTS allowed_servers TEXT[];
ALTER TABLE hub_oauth_codes DROP CONSTRAINT IF EXISTS hub_oauth_code_servers_bound;
ALTER TABLE hub_oauth_codes ADD CONSTRAINT hub_oauth_code_servers_bound
  CHECK (allowed_servers IS NULL OR cardinality(allowed_servers) <= 20);
ALTER TABLE hub_oauth_sessions DROP CONSTRAINT IF EXISTS hub_oauth_session_servers_bound;
ALTER TABLE hub_oauth_sessions ADD CONSTRAINT hub_oauth_session_servers_bound
  CHECK (allowed_servers IS NULL OR cardinality(allowed_servers) <= 20);
