-- C-1: workflow plan / per-step dispatch ledger. Additive and intentionally
-- inert: this schema grants no provider credential or write permission.
-- Never persist provider credentials, raw tool arguments or provider result bodies.
CREATE TABLE IF NOT EXISTS hub_workflow_runs (
 id UUID PRIMARY KEY,
 owner_id TEXT NOT NULL,
 caller_kind TEXT NOT NULL CHECK (caller_kind IN ('pass','oauth')),
 caller_id TEXT NOT NULL,
 authority_digest TEXT NOT NULL CHECK (authority_digest ~ '^[a-f0-9]{64}$'),
 spec_digest TEXT NOT NULL CHECK (spec_digest ~ '^[a-f0-9]{64}$'),
 workflow TEXT NOT NULL CHECK (workflow ~ '^[a-z][a-z0-9_]{2,59}$'),
 state TEXT NOT NULL DEFAULT 'planned'
  CHECK (state IN ('planned','running','complete','failed','unknown','undoing','undone','undo_partial')),
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS hub_workflow_actor_idx
 ON hub_workflow_runs(owner_id,caller_kind,caller_id,created_at DESC);
CREATE TABLE IF NOT EXISTS hub_workflow_steps (
 run_id UUID NOT NULL REFERENCES hub_workflow_runs(id) ON DELETE RESTRICT,
 ordinal SMALLINT NOT NULL CHECK (ordinal BETWEEN 1 AND 10),
 server_name TEXT NOT NULL CHECK (server_name ~ '^[a-z][a-z0-9_-]{1,119}$'),
 tool_name TEXT NOT NULL CHECK (tool_name ~ '^[a-z][a-z0-9_]{2,119}$'),
 args_digest TEXT NOT NULL CHECK (args_digest ~ '^[a-f0-9]{64}
 preview_summary TEXT NOT NULL CHECK (length(preview_summary) BETWEEN 1 AND 400),
 state TEXT NOT NULL DEFAULT 'planned'
  CHECK (state IN ('planned','claimed','confirmed','failed','unknown')),
 provider_log_id TEXT CHECK (length(provider_log_id) <= 128),
 outcome_summary TEXT CHECK (length(outcome_summary) <= 400),
 inverse_tool TEXT CHECK (inverse_tool ~ '^[a-z][a-z0-9_]{2,119}$'),
 inverse_ciphertext TEXT CHECK (length(inverse_ciphertext) <= 8192),
 undo_state TEXT NOT NULL DEFAULT 'not_attempted'
  CHECK (undo_state IN ('not_attempted','claimed','reversed','not_reversible','failed','unknown')),
 undo_log_id TEXT CHECK (length(undo_log_id) <= 128),
 dispatched_at TIMESTAMPTZ,
 finished_at TIMESTAMPTZ,
 PRIMARY KEY (run_id,ordinal),
 CHECK ((inverse_tool IS NULL AND inverse_ciphertext IS NULL)
  OR (inverse_tool IS NOT NULL AND inverse_ciphertext IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS hub_workflow_undo_idx
 ON hub_workflow_steps(run_id,ordinal DESC);
),
 authority_digest TEXT NOT NULL CHECK (authority_digest ~ '^[a-f0-9]{64}
 preview_summary TEXT NOT NULL CHECK (length(preview_summary) BETWEEN 1 AND 400),
 state TEXT NOT NULL DEFAULT 'planned'
  CHECK (state IN ('planned','claimed','confirmed','failed','unknown')),
 provider_log_id TEXT CHECK (length(provider_log_id) <= 128),
 outcome_summary TEXT CHECK (length(outcome_summary) <= 400),
 inverse_tool TEXT CHECK (inverse_tool ~ '^[a-z][a-z0-9_]{2,119}$'),
 inverse_ciphertext TEXT CHECK (length(inverse_ciphertext) <= 8192),
 undo_state TEXT NOT NULL DEFAULT 'not_attempted'
  CHECK (undo_state IN ('not_attempted','claimed','reversed','not_reversible','failed','unknown')),
 undo_log_id TEXT CHECK (length(undo_log_id) <= 128),
 dispatched_at TIMESTAMPTZ,
 finished_at TIMESTAMPTZ,
 PRIMARY KEY (run_id,ordinal),
 CHECK ((inverse_tool IS NULL AND inverse_ciphertext IS NULL)
  OR (inverse_tool IS NOT NULL AND inverse_ciphertext IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS hub_workflow_undo_idx
 ON hub_workflow_steps(run_id,ordinal DESC);
),
 preview_summary TEXT NOT NULL CHECK (length(preview_summary) BETWEEN 1 AND 400),
 state TEXT NOT NULL DEFAULT 'planned'
  CHECK (state IN ('planned','claimed','confirmed','failed','unknown')),
 provider_log_id TEXT CHECK (length(provider_log_id) <= 128),
 outcome_summary TEXT CHECK (length(outcome_summary) <= 400),
 inverse_tool TEXT CHECK (inverse_tool ~ '^[a-z][a-z0-9_]{2,119}$'),
 inverse_ciphertext TEXT CHECK (length(inverse_ciphertext) <= 8192),
 undo_state TEXT NOT NULL DEFAULT 'not_attempted'
  CHECK (undo_state IN ('not_attempted','claimed','reversed','not_reversible','failed','unknown')),
 undo_log_id TEXT CHECK (length(undo_log_id) <= 128),
 dispatched_at TIMESTAMPTZ,
 finished_at TIMESTAMPTZ,
 PRIMARY KEY (run_id,ordinal),
 CHECK ((inverse_tool IS NULL AND inverse_ciphertext IS NULL)
  OR (inverse_tool IS NOT NULL AND inverse_ciphertext IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS hub_workflow_undo_idx
 ON hub_workflow_steps(run_id,ordinal DESC);
