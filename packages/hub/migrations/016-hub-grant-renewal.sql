-- H-4: independent owner may stage one TEST credential for an active
-- service even when that caller already has a verified grant. The new
-- pass is NONCALLABLE until a pinned identity probe and atomic cutover.
-- Do not permit multiple unverified or active grants for a caller/service.
DROP INDEX IF EXISTS hub_grants_active_identity;
CREATE UNIQUE INDEX IF NOT EXISTS hub_grants_verified_identity
 ON hub_server_grants(owner_id,server_name,caller_kind,caller_id)
 WHERE revoked_at IS NULL AND verified_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hub_grants_staged_identity
 ON hub_server_grants(owner_id,server_name,caller_kind,caller_id)
 WHERE revoked_at IS NULL AND verified_at IS NULL;
CREATE TABLE IF NOT EXISTS hub_grant_lifecycle_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 owner_id TEXT NOT NULL,
 server_name TEXT NOT NULL,
 caller_kind TEXT NOT NULL CHECK(caller_kind IN ('pass','oauth')),
 caller_id TEXT NOT NULL,
 staged_grant_id UUID NOT NULL REFERENCES hub_server_grants(id),
 retired_grant_id UUID REFERENCES hub_server_grants(id),
 action TEXT NOT NULL CHECK(action IN ('additional_caller','renewal','cancel_staged','expire_staged','revoke')),
 purged_handles INTEGER NOT NULL CHECK(purged_handles>=0),
 areas TEXT[] NOT NULL CHECK(cardinality(areas) BETWEEN 1 AND 32)
);
CREATE INDEX IF NOT EXISTS hub_grant_lifecycle_owner
 ON hub_grant_lifecycle_audit(owner_id,id DESC);
