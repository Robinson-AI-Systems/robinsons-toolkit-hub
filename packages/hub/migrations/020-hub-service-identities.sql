-- Widen only canonical upstream service identifiers to RTC manifest IDs.
-- Existing RTC tool prefixes, permission areas and external origin rules
-- remain unchanged. Apply on hosted TEST database through checked migrations.
-- Conditional tables also support isolated single-migration SQL tests.
DO $$
BEGIN
  IF to_regclass('hub_servers') IS NOT NULL THEN
    ALTER TABLE hub_servers DROP CONSTRAINT IF EXISTS hub_servers_name_check;
    ALTER TABLE hub_servers ADD CONSTRAINT hub_servers_name_check
      CHECK (name ~ '^[a-z][a-z0-9_-]{0,58}[a-z0-9_]$');
  END IF;
  IF to_regclass('hub_rtc_result_handles') IS NOT NULL THEN
    ALTER TABLE hub_rtc_result_handles DROP CONSTRAINT IF EXISTS hub_rtc_result_handles_server_name_check;
    ALTER TABLE hub_rtc_result_handles ADD CONSTRAINT hub_rtc_result_handles_server_name_check
      CHECK (server_name ~ '^[a-z][a-z0-9_-]{0,58}[a-z0-9_]$');
  END IF;
END $$;
