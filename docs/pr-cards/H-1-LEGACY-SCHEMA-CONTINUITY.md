# H-1 native OAuth migration: preserve existing owner connections

Owner universal directive requires preserving existing legitimate accounts/connections.
Source review of merged native-client registration found that reading its new auth-method
column before separately approved migration 028 would break original developer authentication.
Daily source promotion is not proof the production schema has been migrated.

Frozen outcome: when PostgreSQL specifically reports undefined column (42703), existing
confidential client validation, fixed-callback developer handoff and owner consent retain the
original secret-authenticated behavior. Other DB failures stay closed. Do not infer public
client authentication from old rows, silently issue public clients on old schema, alter
credentials/permissions or install any production migration. New native registration still
requires 028 and rolls back completely if absent. Test migrated and original schemas separately.

Required: focused unit and actual old-schema PostgreSQL legacy flow, negative secret and DB
failure cases, new-registration rollback, full check/unit/DB/immutable source gates, exact-head
ci/release-policy and review. Real migration, native clients and source/live acceptance remain
OPEN. Existing CAP identity scope is not completed by this narrow H-1 regression correction.
