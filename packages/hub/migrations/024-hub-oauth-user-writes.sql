-- C-1: explicit, owner-approved OAuth WRITE delegation, not a developer
-- policy default. Old OAuth codes and sessions remain read-only.
ALTER TABLE hub_oauth_codes
 ADD COLUMN IF NOT EXISTS allow_writes BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hub_oauth_sessions
 ADD COLUMN IF NOT EXISTS allow_writes BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hub_oauth_codes
 ADD CONSTRAINT hub_oauth_code_write_profile
 CHECK (NOT allow_writes OR (profile IN ('everyday','full')
   AND allowed_servers IS NOT NULL));
ALTER TABLE hub_oauth_sessions
 ADD CONSTRAINT hub_oauth_session_write_profile
 CHECK (NOT allow_writes OR (profile IN ('everyday','full')
   AND allowed_servers IS NOT NULL));
