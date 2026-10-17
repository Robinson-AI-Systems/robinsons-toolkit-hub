-- H-4: owner-selected independently issued provider RTC scope.
-- Existing TEST/read_only rows are unchanged. This does NOT activate any
-- profile, issuer credential, hosted migration or provider tool.
-- Provider writes still require an explicitly entitled Hub caller and a
-- separately verified pass with the exact issuer-advertised profile/mode.
ALTER TABLE hub_server_grants
 DROP CONSTRAINT IF EXISTS hub_server_grants_profile_check,
 DROP CONSTRAINT IF EXISTS hub_server_grants_mode_check;
ALTER TABLE hub_server_grants
 ADD CONSTRAINT hub_grant_selected_profile
 CHECK (profile IN ('read_only','everyday','full')),
 ADD CONSTRAINT hub_grant_selected_mode
 CHECK (mode IN ('test','live'));
