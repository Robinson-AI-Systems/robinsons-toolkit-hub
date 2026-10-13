-- H-2 activation requires an independently verified exact TEST/read_only
-- upstream caller pass and a socket-pinned RTC identity check. No scheduled
-- deployment or production database migration is performed by this PR.
ALTER TABLE hub_servers DROP CONSTRAINT IF EXISTS hub_servers_state_check;
ALTER TABLE hub_servers ADD CONSTRAINT hub_servers_state_check
  CHECK (state IN ('pending','active','disabled'));
ALTER TABLE hub_server_grants
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS hub_grants_verified_active_idx
  ON hub_server_grants(server_name,owner_id,verified_at)
  WHERE verified_at IS NOT NULL AND revoked_at IS NULL;
