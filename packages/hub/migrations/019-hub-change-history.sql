-- H-5 durable change-log projection over H-3's already required attempt/outcome
-- ledger. No duplicate mutable table or write path; ambiguous reads stay pending.
-- Historical H-3 audit rows automatically appear without data backfill.
-- Every caller/owner SQL read MUST apply the owner/session/active-grant guards.
CREATE OR REPLACE VIEW hub_change_log AS
 SELECT attempt.id,attempt.occurred_at,attempt.owner_id,
   attempt.caller_kind,attempt.caller_id,attempt.grant_id,
   attempt.server_name,attempt.tool_name,attempt.correlation_id,
   finish.outcome,finish.upstream_log_id,
   CASE
     WHEN finish.outcome='success' THEN 'RTC provider read reported success'
     WHEN finish.outcome='refused' THEN 'RTC provider refused the requested read'
     WHEN finish.outcome='unavailable' THEN
       'RTC provider read outcome unavailable; do not retry automatically'
     ELSE 'RTC read attempted; outcome not recorded'
   END::text AS summary,
   FALSE AS dry_run
 FROM hub_rtc_read_audit attempt
 LEFT JOIN LATERAL (
  SELECT completed.outcome,completed.upstream_log_id
  FROM hub_rtc_read_audit completed
  WHERE completed.owner_id=attempt.owner_id
    AND completed.caller_kind=attempt.caller_kind
    AND completed.caller_id=attempt.caller_id
    AND completed.grant_id=attempt.grant_id
    AND completed.server_name=attempt.server_name
    AND completed.tool_name=attempt.tool_name
    AND completed.correlation_id=attempt.correlation_id
    AND completed.phase='outcome' AND completed.id>attempt.id
  ORDER BY completed.id DESC LIMIT 1
 ) finish ON TRUE
 WHERE attempt.phase='attempt';
