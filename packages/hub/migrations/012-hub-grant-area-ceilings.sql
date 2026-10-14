-- H-4: owner-only additive ceiling on grant areas, without modifying the
-- original signed/encrypted service pass AAD or issuing any new provider grant.
-- A NULL ceiling means the previous areas array. Non-NULL must always be a
-- strict or equal subset of the original areas and can only narrow again.
ALTER TABLE hub_server_grants ADD COLUMN IF NOT EXISTS area_ceiling TEXT[];
ALTER TABLE hub_server_grants DROP CONSTRAINT IF EXISTS hub_grant_area_ceiling_bound;
ALTER TABLE hub_server_grants ADD CONSTRAINT hub_grant_area_ceiling_bound
  CHECK (area_ceiling IS NULL OR (cardinality(area_ceiling) BETWEEN 1 AND 32
    AND area_ceiling <@ areas));

-- Audited in the same SQL statement that also purges old RTC result pages.
-- This table stores no credentials, caller tokens or tool arguments.
CREATE TABLE IF NOT EXISTS hub_grant_scope_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grant_id UUID NOT NULL REFERENCES hub_server_grants(id),
  owner_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action='area_narrow'),
  areas TEXT[] NOT NULL CHECK (cardinality(areas) BETWEEN 1 AND 32),
  CHECK (cardinality(areas) <= 32)
);
CREATE INDEX IF NOT EXISTS hub_grant_scope_audit_grant_at
  ON hub_grant_scope_audit(grant_id,occurred_at DESC);
