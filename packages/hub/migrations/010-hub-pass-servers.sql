-- H-4: an owner-issued Hub pass can additionally restrict the RTC server names
-- for which separately owned, independently verified TEST grants may be used.
-- NULL retains legacy exact-caller-grant behavior; [] deliberately permits none.
-- This changes no existing grant, caller, mode, service state or credentials.
ALTER TABLE hub_callers ADD COLUMN IF NOT EXISTS allowed_servers TEXT[];
ALTER TABLE hub_callers DROP CONSTRAINT IF EXISTS hub_caller_allowed_servers_bound;
ALTER TABLE hub_callers ADD CONSTRAINT hub_caller_allowed_servers_bound
  CHECK (allowed_servers IS NULL OR cardinality(allowed_servers) <= 20);
