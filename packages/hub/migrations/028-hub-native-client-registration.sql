-- Extend registered *client* authentication for independently installed remote
-- MCP coding-agent clients. Existing developer handoff remains confidential.
-- This changes no Hub owner delegation, token, provider grant or caller scope.
ALTER TABLE hub_developer_clients
  ADD COLUMN IF NOT EXISTS token_endpoint_auth_method TEXT
  NOT NULL DEFAULT 'client_secret_post';
DO $migration$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname='hub_developer_client_auth_method_valid'
    AND conrelid='hub_developer_clients'::regclass
 ) THEN
  ALTER TABLE hub_developer_clients
   ADD CONSTRAINT hub_developer_client_auth_method_valid
   CHECK (token_endpoint_auth_method IN ('none','client_secret_post'));
 END IF;
END
$migration$;
