-- H-4: owner-selected area ceilings persist on single-use PKCE consent.
-- Depends on 015 for caller/session policies. No service pass changes.
ALTER TABLE hub_oauth_codes
 ADD COLUMN IF NOT EXISTS service_area_policy JSONB;
ALTER TABLE hub_oauth_codes
 DROP CONSTRAINT IF EXISTS hub_code_area_policy_object;
ALTER TABLE hub_oauth_codes
 ADD CONSTRAINT hub_code_area_policy_object
 CHECK(service_area_policy IS NULL OR
   jsonb_typeof(service_area_policy)='object');
