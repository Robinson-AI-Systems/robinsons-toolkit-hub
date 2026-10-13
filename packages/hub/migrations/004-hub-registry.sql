-- H-2 staged public RTC origins only; no credential stored in this table.
-- Staging never enables routing. A separately approved, encrypted caller grant,
-- pinned-safe transport and verified RTC acceptance are mandatory later.
CREATE TABLE IF NOT EXISTS hub_servers (
  name TEXT PRIMARY KEY CHECK(name ~ '^[a-z][a-z0-9_]{1,59}$'),
  owner_id TEXT NOT NULL,
  prefix TEXT NOT NULL UNIQUE CHECK(prefix ~ '^[a-z][a-z0-9_]{1,59}$'),
  origin TEXT NOT NULL UNIQUE CHECK(length(origin) <= 255),
  claimed_rtc INTEGER NOT NULL CHECK(claimed_rtc=1),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','disabled')),
  claimed_counts JSONB NOT NULL CHECK(jsonb_typeof(claimed_counts)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_servers_owner_idx ON hub_servers(owner_id,name);
